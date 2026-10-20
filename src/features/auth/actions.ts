"use server";

import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { resolveEmailProvider } from "@/lib/email/send";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { platformOrigin } from "@/lib/platform/urls";
import { ADMIN_LOGIN_PATH, SELLER_LOGIN_PATH, landingPathFor } from "@/lib/auth/landing";
import { isSarvamLocaleCode } from "@/lib/sarvam/locales";
import { isStartIntentId } from "@/features/start/intents";
import { isConfirmationEmailFailure, signupFailureMessage } from "./signup-errors";
import { forgotSchema, resetSchema, signInSchema, signUpSchema, startEmailCodeSchema, verifyStartCodeSchema } from "./schemas";

type SignupIdentity = {
  email: string;
  password: string;
  displayName: string;
  storeName?: string;
  plan?: string;
  theme?: string;
  lang: string | null;
  intent: string | null;
};

function accountAlreadyExists(code: string | undefined, message: string): boolean {
  const codeL = (code ?? "").toLowerCase();
  const text = message.toLowerCase();
  return codeL === "email_exists" || codeL === "user_already_exists" || text.includes("already") || text.includes("registered");
}

/**
 * When signup failed only because no email provider could send the confirmation, create (or confirm)
 * the user and sign them in with the password they just chose. A configured provider is never skipped,
 * and an existing password is never replaced.
 */
async function signInWithoutEmailProvider(input: SignupIdentity): Promise<"signed-in" | "exists" | "failed"> {
  const provider = await resolveEmailProvider();
  if (provider.apiKey) return "failed";
  const admin = createSupabaseAdminClient();
  const metadata = {
    display_name: input.displayName,
    store_name: input.storeName ?? null,
    requested_plan: input.plan ?? null,
    requested_theme: input.theme ?? null,
    onboarding_locale: input.lang,
    onboarding_intent: input.intent,
  };
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (created.error && !accountAlreadyExists(created.error.code, created.error.message)) {
    logger.warn("auth.signup_confirm_failed", { code: created.error.code ?? null, detail: created.error.message.slice(0, 160) });
    return "failed";
  }
  if (created.error) {
    const found = await admin.auth.admin.generateLink({ type: "magiclink", email: input.email });
    const userId = found.data?.user?.id;
    if (!userId) {
      logger.warn("auth.signup_confirm_lookup_failed", { code: found.error?.code ?? null });
      return "failed";
    }
    const updated = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (updated.error) {
      logger.warn("auth.signup_confirm_update_failed", { code: updated.error.code ?? null, detail: updated.error.message.slice(0, 160) });
      return "failed";
    }
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    logger.warn("auth.signup_confirm_signin_failed", { code: error.code ?? null, detail: error.message.slice(0, 160) });
    return created.error ? "exists" : "failed";
  }
  return "signed-in";
}

export async function signInAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let next = "/dashboard";
  const result = await runAction("auth.signIn", async () => {
    const input = parseInput(signInSchema, formToObject(fd));
    await rateLimit("login:ip", await clientIpKey(), 20, 600);
    await rateLimit("login:email", input.email, 8, 600);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    // Same message for unknown email and wrong password (no account enumeration).
    if (error) throw new AppError("UNAUTHENTICATED", { message: "Email or password is incorrect.", fieldErrors: { _form: ["Email or password is incorrect."] } });
    // Explicit ?next wins; otherwise land sellers on the dashboard and platform staff on /admin.
    next = input.next ? safeRedirectPath(input.next, "/dashboard") : await landingPathFor(data.user.id);
  });
  if (result.ok) redirect(next);
  return result;
}

export async function signUpAction(_prev: ActionResult<{ needsConfirmation: boolean }> | null, fd: FormData): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  let next = "/onboarding";
  let confirmed = false;
  const result = await runAction("auth.signUp", async () => {
    const input = parseInput(signUpSchema, formToObject(fd));
    next = safeRedirectPath(input.next, "/onboarding");
    const qs = new URLSearchParams();
    const lang = input.lang && isSarvamLocaleCode(input.lang) ? input.lang : null;
    const intent = input.intent && isStartIntentId(input.intent) ? input.intent : null;
    if (input.storeName) qs.set("name", input.storeName);
    if (input.plan) qs.set("plan", input.plan);
    if (input.theme) qs.set("theme", input.theme);
    if (lang) qs.set("lang", lang);
    const onboarding = qs.size ? `/onboarding?${qs}` : "/onboarding";
    await rateLimit("signup:ip", await clientIpKey(), 10, 3600);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Plan/theme/locale from marketing /start survive email confirmation via user metadata.
        data: {
          display_name: input.displayName,
          store_name: input.storeName ?? null,
          requested_plan: input.plan ?? null,
          requested_theme: input.theme ?? null,
          onboarding_locale: lang,
          onboarding_intent: intent,
        },
        emailRedirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent(input.next ? next : onboarding)}`,
      },
    });
    if (error) {
      logger.warn("auth.signup_failed", { code: error.code ?? null, detail: error.message.slice(0, 180) });
      if (isConfirmationEmailFailure(error.code, error.message)) {
        const recovered = await signInWithoutEmailProvider({
          email: input.email,
          password: input.password,
          displayName: input.displayName,
          storeName: input.storeName,
          plan: input.plan,
          theme: input.theme,
          lang,
          intent,
        });
        if (recovered === "signed-in") {
          confirmed = true;
          if (!input.next) next = onboarding;
          return { needsConfirmation: false };
        }
        if (recovered === "exists") {
          throw new AppError("VALIDATION", { fieldErrors: { _form: ["An account with this email already exists."] } });
        }
      }
      throw new AppError("VALIDATION", { fieldErrors: { _form: [signupFailureMessage(error.code, error.message)] } });
    }
    confirmed = Boolean(data.session);
    // Signed in straight away (email confirmation off): continue to onboarding, where the seller
    // confirms the store address, category, theme and plan before the (draft) store is created.
    if (data.session && !input.next) next = onboarding;
    return { needsConfirmation: !data.session };
  });
  if (result.ok && confirmed) redirect(next);
  return result;
}

/** Email a one-time code that creates the merchant account when it does not exist yet. */
export async function requestStartEmailCodeAction(
  _prev: ActionResult<{ email: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ email: string }>> {
  return runAction("auth.startEmailCode", async () => {
    const input = parseInput(startEmailCodeSchema, formToObject(fd));
    await rateLimit("start-otp:ip", await clientIpKey(), 10, 3600);
    await rateLimit("start-otp:email", input.email, 5, 3600);
    const lang = input.lang && isSarvamLocaleCode(input.lang) ? input.lang : null;
    const intent = input.intent && isStartIntentId(input.intent) ? input.intent : null;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: input.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent(safeRedirectPath(input.next, "/start"))}`,
        data: {
          display_name: input.displayName?.trim() || null,
          store_name: input.storeName ?? null,
          requested_plan: input.plan ?? null,
          requested_theme: input.theme ?? null,
          onboarding_locale: lang,
          onboarding_intent: intent,
        },
      },
    });
    if (error) {
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["Couldn't send a code. Try again in a moment."] } });
    }
    return { email: input.email };
  });
}

/** Confirm the emailed code and return to /start with a verified session. */
export async function verifyStartEmailCodeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let next = "/start";
  const result = await runAction("auth.verifyStartCode", async () => {
    const input = parseInput(verifyStartCodeSchema, formToObject(fd));
    next = safeRedirectPath(input.next, "/start");
    await rateLimit("start-otp-verify:email", input.email, 10, 600);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ email: input.email, token: input.token, type: input.type });
    if (error) throw new AppError("VALIDATION", { fieldErrors: { token: ["That code is invalid or has expired."] } });
  });
  if (result.ok) redirect(next);
  return result;
}

export async function forgotPasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction("auth.forgotPassword", async () => {
    const input = parseInput(forgotSchema, formToObject(fd));
    await rateLimit("reset:ip", await clientIpKey(), 5, 3600);
    await rateLimit("reset:email", input.email, 3, 3600);
    const supabase = await createSupabaseServerClient();
    // Always report success so the form doesn't reveal which emails have accounts.
    await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${platformOrigin()}/auth/callback?next=/reset-password` });
  });
}

export async function resetPasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("auth.resetPassword", async () => {
    const input = parseInput(resetSchema, formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AppError("UNAUTHENTICATED", { fieldErrors: { _form: ["Your reset link has expired. Request a new one."] } });
  });
  if (result.ok) redirect("/dashboard");
  return result;
}

/** Signs out; the platform console passes `to=admin` so staff return to its own sign-in screen. */
export async function signOutAction(fd?: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(fd?.get("to") === "admin" ? ADMIN_LOGIN_PATH : SELLER_LOGIN_PATH);
}

/**
 * "Continue with Google" for merchants: starts Supabase's OAuth (PKCE) flow and sends the browser
 * to Google. The platform /auth/callback exchanges the code; new accounts continue to onboarding.
 */
export async function googleSignInAction(fd: FormData): Promise<void> {
  const next = safeRedirectPath(typeof fd.get("next") === "string" ? (fd.get("next") as string) : "", "/dashboard");
  await rateLimit("login:ip", await clientIpKey(), 20, 600);
  if (!(await getPublicPlatformConfig()).googleForSellers) redirect(`${SELLER_LOGIN_PATH}?error=google`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`${SELLER_LOGIN_PATH}?error=google`);
  redirect(data.url);
}
