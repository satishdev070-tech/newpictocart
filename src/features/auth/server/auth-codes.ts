import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { handleAuthEmailHook } from "@/features/notifications/email/auth-hook";
import type { AuthEmailAction } from "@/features/notifications/email/account-templates";

/**
 * Sign-up, sign-in and password-reset codes sent by the app instead of Supabase's mailer
 * (ADR-006 addition, 2026-10-24).
 *
 * Supabase's built-in mailer allows ~2 emails an hour and never reached Resend ("Too many
 * attempts", no auth emails in the Resend log). Here the Admin API's generateLink creates the
 * one-time code and link WITHOUT sending anything, and the same renderer as the Send Email hook
 * brands the email (the store on store hosts, Pictocart otherwise) and sends it with sendEmail()
 * (Resend, email_log). The browser then verifies the code with verifyOtp as before.
 */

export type AuthCodeKind = "signin" | "recovery";
/** `codeLength` is always 6 — app UI/schemas are fixed; hosted Auth → Email → Email OTP Length must be 6. */
export type AuthCodeResult = { status: "sent"; codeLength: number } | { status: "no-account" } | { status: "failed"; reason: "provider" | "auth" };

/** verifyOtp type for a code sent with `kind`. */
export function verifyTypeFor(kind: AuthCodeKind): "email" | "recovery" {
  return kind === "recovery" ? "recovery" : "email";
}

function notFound(code: string | undefined, message: string): boolean {
  const c = (code ?? "").toLowerCase();
  const m = message.toLowerCase();
  return c === "user_not_found" || m.includes("not found") || m.includes("no user");
}

/**
 * Email a one-time code (plus a one-click link) to `email`.
 *  - signin: creates the account when `createUser` is set and it doesn't exist yet (sign-up by code);
 *    new accounts get the "confirm your email" copy, existing ones "your sign-in code".
 *  - recovery: password reset; unknown emails return "no-account" (callers still say "sent").
 * `redirectTo` must be a callback on a host we serve (platform or the store); the hook renderer
 * only ever links to that host.
 */
export async function sendAuthCode(input: {
  email: string;
  kind: AuthCodeKind;
  redirectTo: string;
  createUser?: boolean;
  userMetadata?: Record<string, unknown>;
}): Promise<AuthCodeResult> {
  const admin = createSupabaseAdminClient();
  const email = input.email.trim().toLowerCase();
  let created = false;

  const generate = () =>
    input.kind === "recovery"
      ? admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: input.redirectTo } })
      : admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: input.redirectTo } });

  let link = await generate();
  if (link.error && input.kind === "signin" && input.createUser && notFound(link.error.code, link.error.message)) {
    const made = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: input.userMetadata ?? {} });
    if (made.error) {
      logger.warn("auth.code_create_user_failed", { code: made.error.code ?? null, detail: made.error.message.slice(0, 160) });
      return { status: "failed", reason: "auth" };
    }
    created = true;
    link = await generate();
  }
  if (link.error || !link.data?.properties || !link.data.user) {
    if (link.error && notFound(link.error.code, link.error.message)) return { status: "no-account" };
    logger.warn("auth.code_generate_failed", { kind: input.kind, code: link.error?.code ?? null, detail: link.error?.message.slice(0, 160) ?? null });
    return { status: "failed", reason: "auth" };
  }

  const user = link.data.user;
  // A brand-new account (or one that never confirmed) gets the sign-up copy and its metadata.
  const isNew = created || !user.email_confirmed_at;
  if (isNew && input.userMetadata && Object.keys(input.userMetadata).length) {
    const meta = { ...input.userMetadata, ...(user.user_metadata ?? {}) };
    await admin.auth.admin.updateUserById(user.id, { user_metadata: meta }).catch(() => undefined);
  }

  const props = link.data.properties;
  const action: AuthEmailAction = input.kind === "recovery" ? "recovery" : isNew ? "signup" : "magiclink";
  const result = await handleAuthEmailHook({
    user: { id: user.id, email, new_email: null, user_metadata: user.user_metadata ?? null },
    email_data: {
      token: props.email_otp ?? null,
      token_hash: props.hashed_token ?? null,
      redirect_to: input.redirectTo,
      email_action_type: action,
      site_url: null,
      token_new: null,
      token_hash_new: null,
    },
  }, { linkType: verifyTypeFor(input.kind) });
  if (!result.ok) return { status: "failed", reason: "provider" };
  // "logged" = no email provider configured: nothing was delivered.
  if (result.sent.some((s) => s.status === "logged")) return { status: "failed", reason: "provider" };
  // Still send when email_otp length !== 6 (hosted misconfig); UI always shows 6 boxes — fix Email OTP Length to 6.
  return { status: "sent", codeLength: codeLengthOf(props.email_otp) };
}

/** Always 6 — same shape as a successful send when the email was unknown (reset). */
export function knownCodeLength(): number {
  return 6;
}

/**
 * Always 6. Hosted Supabase Auth → Email → Email OTP Length must be 6; we still email whatever
 * generateLink returns, but the app only accepts / displays 6 digits.
 */
export function codeLengthOf(_otp?: string | null): number {
  return 6;
}

/** Message for a failed send, shown on the form. */
export function authCodeFailureMessage(r: AuthCodeResult): string {
  if (r.status === "failed" && r.reason === "provider") return "We couldn't send the email right now. Please try again in a minute.";
  return "Couldn't send a code. Try again in a moment.";
}
