import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { toClaimResult, toVerifyResult, type ClaimResult, type VerificationStatus, type VerifyResult } from "./schemas";

/**
 * Verification reward (migration 9200). Reads and the code check / claim use the person's own
 * session (RLS + SECURITY DEFINER functions keyed on auth.uid()). One secret-key call
 * (ADR-006): `svc_start_phone_verification` for the user id the server just verified, so a code
 * can only be obtained by receiving the WhatsApp message.
 */

const NOT_READY = "Phone verification isn't available yet. Please try again later.";

/** Email + WhatsApp verification and the reward row; null when the migration isn't applied. */
export async function getVerificationStatus(): Promise<VerificationStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const user = auth.user;
  const [profile, reward] = await Promise.all([
    supabase.from("profiles").select("phone, phone_verified_at").eq("id", user.id).maybeSingle(),
    supabase.from("verification_rewards").select("credits, created_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (isMissingSchemaError(profile.error) || isMissingSchemaError(reward.error)) return null;
  if (profile.error || reward.error) {
    logger.warn("verification.status_failed", { profile: profile.error?.code, reward: reward.error?.code });
    return null;
  }
  const phone = profile.data?.phone ?? null;
  return {
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    phone,
    phoneVerified: Boolean(phone && profile.data?.phone_verified_at),
    reward: reward.data ? { credits: reward.data.credits, createdAt: reward.data.created_at } : null,
  };
}

/** Creates a fresh 10-minute code for this (server-verified) user. Returns the code to send. */
export async function startPhoneVerification(userId: string, phone: string): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().rpc("svc_start_phone_verification", { p_user: userId, p_phone: phone });
  if (error) {
    if (isMissingSchemaError(error)) throw new AppError("VALIDATION", { fieldErrors: { _form: [NOT_READY] } });
    if (error.hint === "PHONE_CODE_LIMIT") throw new AppError("RATE_LIMITED", { fieldErrors: { _form: ["Too many codes in the last hour. Please wait and try again."] } });
    throw mapDbError(error);
  }
  if (typeof data !== "string" || !/^[0-9]{6}$/.test(data)) throw new AppError("INTERNAL", { context: { reason: "bad_code_shape" } });
  return data;
}

export async function verifyPhoneCode(phone: string, code: string): Promise<VerifyResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("verify_phone_code", { p_phone: phone, p_code: code });
  if (error) {
    if (isMissingSchemaError(error)) throw new AppError("VALIDATION", { fieldErrors: { _form: [NOT_READY] } });
    throw mapDbError(error);
  }
  return toVerifyResult(data);
}

/** claim_verification_bonus for the membership-resolved tenant (the RPC re-checks ownership). */
export async function claimVerificationBonus(tenantId: string): Promise<ClaimResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_verification_bonus", { p_tenant: tenantId });
  if (error) {
    if (isMissingSchemaError(error)) throw new AppError("VALIDATION", { fieldErrors: { _form: ["The verification bonus isn't available yet."] } });
    throw mapDbError(error);
  }
  return toClaimResult(Array.isArray(data) ? data[0] : data);
}
