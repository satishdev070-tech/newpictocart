"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { sha256Hex } from "@/lib/crypto";
import { assertPermission, requireTenant } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env/public";
import { formatPhone } from "@/lib/validation/phone";
import { logger } from "@/lib/observability/logger";
import { getPlatformWhatsappSender, sendWhatsappOtp } from "@/features/platform-apps/whatsapp-otp";
import { allowDevCode, claimStatusMessage, sendPhoneCodeSchema, verifyPhoneCodeSchema, verifyResultMessage, type ClaimResult } from "./schemas";
import { claimVerificationBonus, startPhoneVerification, verifyPhoneCode } from "./server";

export type SendCodeResult = { phone: string; display: string; devCode?: string };
export type VerifyCodeResult = { claim: ClaimResult | null };

async function limited(bucket: string, subject: string, limit: number, windowSeconds: number, message: string) {
  try {
    await rateLimit(bucket, subject, limit, windowSeconds);
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: [message] } });
    throw err;
  }
}

function revalidate() {
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}

/**
 * My Profile → Verify WhatsApp number → Send code. The user id comes from the verified session;
 * the code is created with the secret-key client (svc_start_phone_verification is service_role
 * only) and sent on the platform WhatsApp number. Only on a localhost platform with no sender
 * configured is the code returned to the browser (local testing).
 */
export async function sendPhoneCodeAction(_prev: ActionResult<SendCodeResult> | null, fd: FormData): Promise<ActionResult<SendCodeResult>> {
  return runAction("verification.sendCode", async () => {
    const { phone } = parseInput(sendPhoneCodeSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "store.read");
    await limited("verify-phone-send-user", ctx.user.id, 5, 3600, "Too many codes requested. Please wait a few minutes and try again.");
    await limited("verify-phone-send-phone", sha256Hex(phone).slice(0, 24), 5, 86_400, "Too many codes sent to this number today. Try again tomorrow.");

    const sender = await getPlatformWhatsappSender();
    const dev = allowDevCode(Boolean(sender), publicEnv().NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN);
    if (!sender && !dev) throw new AppError("VALIDATION", { fieldErrors: { _form: ["WhatsApp verification isn't set up yet. Please try again later."] } });

    const code = await startPhoneVerification(ctx.user.id, phone);
    if (sender) {
      const sent = await sendWhatsappOtp(sender, phone, code);
      if (!sent.ok) throw new AppError("VALIDATION", { fieldErrors: { _form: ["We couldn't send the WhatsApp message. Check the number is on WhatsApp and try again."] }, context: { reason: sent.message } });
      return { phone, display: formatPhone(phone) };
    }
    logger.info("verification.dev_code_shown", { userId: ctx.user.id });
    return { phone, display: formatPhone(phone), devCode: code };
  });
}

/** Checks the code; on success the bonus is claimed right away for the member's own store (owners). */
export async function verifyPhoneCodeAction(_prev: ActionResult<VerifyCodeResult> | null, fd: FormData): Promise<ActionResult<VerifyCodeResult>> {
  return runAction("verification.verifyCode", async () => {
    const { phone, code } = parseInput(verifyPhoneCodeSchema, formToObject(fd));
    const ctx = await requireTenant();
    assertPermission(ctx, "store.read");
    await limited("verify-phone-check", ctx.user.id, 20, 3600, "Too many tries. Please wait a few minutes and try again.");
    const result = await verifyPhoneCode(phone, code);
    const message = verifyResultMessage(result);
    if (message) throw new AppError("VALIDATION", { fieldErrors: { code: [message] } });

    let claim: ClaimResult | null = null;
    if (ctx.role === "owner") {
      try {
        claim = await claimVerificationBonus(ctx.tenantId);
      } catch (err) {
        // The number is verified either way; the dashboard card can claim later.
        logger.warn("verification.auto_claim_failed", { error: err });
      }
    }
    revalidate();
    return { claim };
  });
}

/** Dashboard → Claim 250 free AI credits. Store owner only; tenant from the membership. */
export async function claimVerificationBonusAction(_prev: ActionResult<ClaimResult> | null, _fd: FormData): Promise<ActionResult<ClaimResult>> {
  return runAction("verification.claim", async () => {
    const ctx = await requireTenant();
    assertPermission(ctx, "billing.manage");
    await limited("verify-claim", ctx.user.id, 10, 3600, "Too many tries. Please wait a few minutes and try again.");
    const claim = await claimVerificationBonus(ctx.tenantId);
    if (claim.status !== "claimed" && claim.status !== "already_claimed") throw new AppError("VALIDATION", { fieldErrors: { _form: [claimStatusMessage(claim.status)] } });
    revalidate();
    return claim;
  });
}

/** Re-sends the signup confirmation email (Supabase Auth) to the signed-in user's own address. */
export async function resendEmailConfirmationAction(_prev: ActionResult<{ sent: boolean }> | null, _fd: FormData): Promise<ActionResult<{ sent: boolean }>> {
  return runAction("verification.resendEmail", async () => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!data.user || !email) throw new AppError("UNAUTHENTICATED");
    if (data.user.email_confirmed_at) return { sent: false };
    await limited("verify-email-resend", data.user.id, 3, 3600, "We already sent a few links. Please check your inbox and spam, or try again in an hour.");
    const { platformOrigin } = await import("@/lib/platform/urls");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${platformOrigin()}/auth/callback?next=${encodeURIComponent("/dashboard/profile")}` },
    });
    if (error) {
      logger.warn("verification.resend_email_failed", { code: error.code });
      throw new AppError("VALIDATION", { fieldErrors: { _form: ["We couldn't send the email right now. Please try again later."] } });
    }
    return { sent: true };
  });
}
