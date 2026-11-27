import { z } from "zod";
import { phoneSchema } from "@/lib/validation/phone";

/**
 * Verification reward (pure). A store owner who verifies both their email (Supabase Auth
 * `email_confirmed_at`) and their WhatsApp number (`profiles.phone_verified_at`) can claim
 * 250 AI credits once (`claim_verification_bonus`, migration 9200).
 */

export const VERIFICATION_BONUS_CREDITS = 250;

export const sendPhoneCodeSchema = z.object({ phone: phoneSchema });
export const verifyPhoneCodeSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[0-9]{6}$/, "Enter the 6-digit code from WhatsApp")),
});

export type VerificationStatus = {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  /** The bonus row (one per person, ever), or null when not yet claimed. */
  reward: { credits: number; createdAt: string } | null;
};

export type MissingStep = "both" | "email" | "phone" | null;

/** Which verification is still missing (null = both done). */
export function missingStep(s: Pick<VerificationStatus, "emailVerified" | "phoneVerified">): MissingStep {
  if (!s.emailVerified && !s.phoneVerified) return "both";
  if (!s.emailVerified) return "email";
  if (!s.phoneVerified) return "phone";
  return null;
}

/** The dashboard card shows for owners only, and only until the reward is claimed. */
export function showClaimCard(s: VerificationStatus | null, isOwner: boolean): boolean {
  return Boolean(s && isOwner && !s.reward);
}

/**
 * Codes are shown on screen only when no WhatsApp sender is configured AND the platform root
 * is `localhost` (local development). Anywhere else the code must be received on WhatsApp.
 */
export function allowDevCode(senderConfigured: boolean, rootDomain: string | null | undefined): boolean {
  return !senderConfigured && (rootDomain ?? "").trim().toLowerCase() === "localhost";
}

export const VERIFY_RESULTS = ["verified", "wrong", "expired", "locked", "none"] as const;
export type VerifyResult = (typeof VERIFY_RESULTS)[number];

export function toVerifyResult(v: unknown): VerifyResult {
  return (VERIFY_RESULTS as readonly unknown[]).includes(v) ? (v as VerifyResult) : "none";
}

/** User-facing sentence for a failed code check (null for "verified"). */
export function verifyResultMessage(r: VerifyResult): string | null {
  switch (r) {
    case "verified":
      return null;
    case "wrong":
      return "That code isn't right. Check the WhatsApp message and try again.";
    case "expired":
      return "That code has expired. Send a new code.";
    case "locked":
      return "Too many wrong tries. Send a new code.";
    case "none":
      return "Send a code to this number first.";
  }
}

export const CLAIM_STATUSES = ["claimed", "already_claimed", "email_missing", "phone_missing", "both_missing", "phone_used", "not_owner"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type ClaimResult = { status: ClaimStatus; credits: number; balance: number | null };

export function toClaimResult(row: { status?: unknown; credits?: unknown; balance?: unknown } | null | undefined): ClaimResult {
  const status = (CLAIM_STATUSES as readonly unknown[]).includes(row?.status) ? (row!.status as ClaimStatus) : "not_owner";
  return { status, credits: typeof row?.credits === "number" ? row.credits : 0, balance: typeof row?.balance === "number" ? row.balance : null };
}

export function claimStatusMessage(s: ClaimStatus, credits = VERIFICATION_BONUS_CREDITS): string {
  switch (s) {
    case "claimed":
      return `${credits} free AI credits added to your wallet.`;
    case "already_claimed":
      return "The verification bonus has already been claimed.";
    case "email_missing":
      return "Verify your email first, then claim.";
    case "phone_missing":
      return "Verify your WhatsApp number first, then claim.";
    case "both_missing":
      return "Verify your email and your WhatsApp number first.";
    case "phone_used":
      return "This WhatsApp number has already been used for a verification bonus.";
    case "not_owner":
      return "Only the store owner can claim the verification bonus.";
  }
}
