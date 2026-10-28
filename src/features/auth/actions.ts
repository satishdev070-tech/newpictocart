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
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { platformOrigin } from "@/lib/platform/urls";
import { LOGIN_PATH, landingPathFor } from "@/lib/auth/landing";
import { isSarvamLocaleCode } from "@/lib/sarvam/locales";
import { isStartIntentId } from "@/features/start/intents";
import { isConfirmationEmailFailure, shouldConfirmWithoutEmail, signupFailureMessage } from "./signup-errors";
import { forgotSchema, merchantCodeSchema, resetSchema, signInSchema, signUpSchema, startEmailCodeSchema, verifyMerchantCodeSchema, verifyResetCodeSchema, verifyStartCodeSchema } from "./schemas";
import { authCodeFailureMessage, knownCodeLength, sendAuthCode } from "./server/auth-codes";

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
 * When signup failed only because the confirmation email could not be sent, create (or confirm)
 * the user and sign them in with the password they just chose. An existing password is never replaced.
 * Production with a working provider configured still refuses this path.
 */
async function signInWithoutEmailProvider(input: SignupIdentity): Promise<"signed-in" | "exists" | "failed"> {
  const provider = await resolveEmailProvider();
  const allow = shouldConfirmWithoutEmail(Boolean(provider.apiKey), serverEnv().NODE_ENV, publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN);
  if (!allow) return "failed";
  logger.warn("auth.signup_email_skipped", { reason: provider.apiKey ? "provider_failed" : "provider_missing" });
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
    // One login for everyone: platform staff land on /admin, sellers on /dashboard. A requested
    // ?next is honoured only when this account can use that panel (role-routing.ts).
    next = await landingPathFor(data.user.id, safeRedirectPath(input.next, ""));
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
    if (!data.session && data.user) {
      const provider = await resolveEmailProvider();
      if (!provider.apiKey) {
        const admin = createSupabaseAdminClient();
        const updated = await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
        if (!updated.error) {
          const signed = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
          if (!signed.error && signed.data.session) {
            confirmed = true;
            if (!input.next) next = onboarding;
            return { needsConfirmation: false };
          }
        }
      }
    }
    return { needsConfirmation: !data.session };
  });
  if (result.ok && confirmed) redirect(next);
  return result;
}

/** Email a one-time code that creates the merchant account when it does not exist yet. */
export async function requestStartEmailCodeAction(
  _prev: ActionResult<{ email: string; codeLength?: number }> | null,
  fd: FormData,
): Promise<ActionResult<{ email: string; codeLength?: number }>> {
  return runAction("auth.startEmailCode", async () => {
    const input = parseInput(startEmailCodeSchema, formToObject(fd));
    await rateLimit("start-otp:ip", await clientIpKey(), 10, 3600);
    await rateLimit("start-otp:email", input.email, 5, 3600);
    const lang = input.lang && isSarvamLocaleCode(input.lang) ? input.lang : null;
    const intent = input.intent && isStartIntentId(input.intent) ? input.intent : null;
    // Sent by the app through Resend (auth-codes.ts), not Supabase's rate-limited mailer.
    const sent = await sendAuthCode({
      email: input.email,
      kind: "signin",
      createUser: true,
      redirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent(safeRedirectPath(input.next, "/start"))}`,
      userMetadata: {
        display_name: input.displayName?.trim() || null,
        store_name: input.storeName ?? null,
        requested_plan: input.plan ?? null,
        requested_theme: input.theme ?? null,
        onboarding_locale: lang,
        onboarding_intent: intent,
      },
    });
    if (sent.status !== "sent") throw new AppError("VALIDATION", { fieldErrors: { _form: [authCodeFailureMessage(sent)] } });
    return { email: input.email, codeLength: sent.codeLength };
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

export async function forgotPasswordAction(_prev: ActionResult<{ email: string; codeLength?: number }> | null, fd: FormData): Promise<ActionResult<{ email: string; codeLength?: number }>> {
  return runAction("auth.forgotPassword", async () => {
    const input = parseInput(forgotSchema, formToObject(fd));
    await rateLimit("reset:ip", await clientIpKey(), 5, 3600);
    await rateLimit("reset:email", input.email, 3, 3600);
    // Sent by the app through Resend. Unknown emails still report success (no account enumeration);
    // only a real delivery failure is shown.
    const sent = await sendAuthCode({ email: input.email, kind: "recovery", redirectTo: `${platformOrigin()}/auth/callback?next=/reset-password` });
    if (sent.status === "failed") throw new AppError("VALIDATION", { fieldErrors: { _form: [authCodeFailureMessage(sent)] } });
    return { email: input.email, codeLength: sent.status === "sent" ? sent.codeLength : knownCodeLength() };
  });
}

/** Reset by code: verifies the code from the reset email, then the seller picks a new password. */
export async function verifyResetCodeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("auth.verifyResetCode", async () => {
    const input = parseInput(verifyResetCodeSchema, formToObject(fd));
    await rateLimit("reset-verify:email", input.email, 10, 600);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ email: input.email, token: input.token, type: "recovery" });
    if (error) throw new AppError("VALIDATION", { fieldErrors: { token: ["That code is invalid or has expired."] } });
  });
  if (result.ok) redirect("/reset-password");
  return result;
}

/**
 * Merchant sign-up / sign-in by email code (the new auth screens): one code for both. A new email
 * gets an account (then onboarding: "What are you building?"); an existing one signs in.
 */
export async function requestMerchantCodeAction(_prev: ActionResult<{ email: string; codeLength?: number }> | null, fd: FormData): Promise<ActionResult<{ email: string; codeLength?: number }>> {
  return runAction("auth.merchantCode", async () => {
    const input = parseInput(merchantCodeSchema, formToObject(fd));
    await rateLimit("merchant-otp:ip", await clientIpKey(), 15, 3600);
    await rateLimit("merchant-otp:email", input.email, 6, 3600);
    const lang = input.lang && isSarvamLocaleCode(input.lang) ? input.lang : null;
    const intent = input.intent && isStartIntentId(input.intent) ? input.intent : null;
    // No default for sign-in: the callback picks the panel from the account (role-routing.ts).
    const next = safeRedirectPath(input.next, input.mode === "signup" ? "/onboarding" : "");
    const sent = await sendAuthCode({
      email: input.email,
      kind: "signin",
      createUser: true,
      redirectTo: next ? `${platformOrigin()}/auth/callback?next=${encodeURIComponent(next)}` : `${platformOrigin()}/auth/callback`,
      userMetadata: {
        display_name: input.displayName?.trim() || null,
        store_name: input.storeName ?? null,
        requested_plan: input.plan ?? null,
        requested_theme: input.theme ?? null,
        onboarding_locale: lang,
        onboarding_intent: intent,
      },
    });
    if (sent.status !== "sent") throw new AppError("VALIDATION", { fieldErrors: { _form: [authCodeFailureMessage(sent)] } });
    return { email: input.email, codeLength: sent.codeLength };
  });
}

export async function verifyMerchantCodeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let next = "/dashboard";
  const result = await runAction("auth.verifyMerchantCode", async () => {
    const input = parseInput(verifyMerchantCodeSchema, formToObject(fd));
    await rateLimit("merchant-otp-verify:email", input.email, 10, 600);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: input.email, token: input.token, type: "email" });
    if (error || !data.user) throw new AppError("VALIDATION", { fieldErrors: { token: ["That code is invalid or has expired."] } });
    // Staff → /admin, sellers → dashboard, new accounts → onboarding; ?next only when usable.
    next = await landingPathFor(data.user.id, safeRedirectPath(input.next, ""));
  });
  if (result.ok) redirect(next);
  return result;
}

export async function resetPasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction("auth.resetPassword", async () => {
    const input = parseInput(resetSchema, formToObject(fd));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AppError("UNAUTHENTICATED", { fieldErrors: { _form: ["Your reset link has expired. Request a new one."] } });
  });
  // Signed in: the shared login page forwards to this account's panel (admin or dashboard).
  if (result.ok) redirect(LOGIN_PATH);
  return result;
}

/** Signs out to the shared sign-in page (sellers and platform staff use the same one). */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

/**
 * "Continue with Google" for merchants: starts Supabase's OAuth (PKCE) flow and sends the browser
 * to Google. The platform /auth/callback exchanges the code; new accounts continue to onboarding.
 */
export async function googleSignInAction(fd: FormData): Promise<void> {
  // Empty next: the callback picks the panel from the account (staff → /admin, sellers → /dashboard).
  const next = safeRedirectPath(typeof fd.get("next") === "string" ? (fd.get("next") as string) : "", "");
  await rateLimit("login:ip", await clientIpKey(), 20, 600);
  if (!(await getPublicPlatformConfig()).googleForSellers) redirect(`${LOGIN_PATH}?error=google`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: next ? `${platformOrigin()}/auth/callback?next=${encodeURIComponent(next)}` : `${platformOrigin()}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`${LOGIN_PATH}?error=google`);
  redirect(data.url);
}

/**
 * Google sign-in through Google Identity Services (the button rendered by Google on OUR domain):
 * the browser gets a Google ID token and Supabase verifies it (signInWithIdToken). Unlike the
 * redirect flow, Google's consent shows pictocartdev.in instead of the Supabase project URL.
 * `nonce` is the raw value whose SHA-256 was given to Google, so the token can't be replayed.
 */
export async function googleIdTokenSignInAction(input: { credential: string; nonce: string; next?: string }): Promise<ActionResult<{ next: string }>> {
  return runAction("auth.googleIdToken", async () => {
    await rateLimit("login:ip", await clientIpKey(), 20, 600);
    if (!(await getPublicPlatformConfig()).googleForSellers) throw new AppError("FORBIDDEN", { message: "Google sign-in is turned off." });
    if (typeof input.credential !== "string" || input.credential.length < 20 || input.credential.length > 4096) throw new AppError("VALIDATION");
    if (typeof input.nonce !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(input.nonce)) throw new AppError("VALIDATION");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: input.credential, nonce: input.nonce });
    if (error || !data.user) {
      logger.warn("auth.google_id_token_failed", { code: error?.code ?? null, detail: error?.message.slice(0, 160) ?? null });
      throw new AppError("UNAUTHENTICATED", { message: "Google sign-in didn't complete. Please try again or use your email." });
    }
    const next = await landingPathFor(data.user.id, safeRedirectPath(input.next, ""));
    return { next };
  });
}
