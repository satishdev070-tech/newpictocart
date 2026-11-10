import { z } from "zod";
import { toMinor } from "@/lib/money";

export const AI_CREDIT_PACKS = {
  starter: { credits: 100, amountMinor: 9_900, label: "Starter" },
  growth: { credits: 500, amountMinor: 39_900, label: "Growth" },
  pro: { credits: 1500, amountMinor: 99_900, label: "Pro" },
} as const;

export type AiCreditPack = keyof typeof AI_CREDIT_PACKS;
export const AI_CREDIT_PACK_KEYS = Object.keys(AI_CREDIT_PACKS) as AiCreditPack[];

/** Fallback when migration 3900 (ai_credit_packs) is not applied: the packs hard-coded in migration 3400. */
export const FALLBACK_PACKS = AI_CREDIT_PACK_KEYS.map((code, i) => ({ code, label: AI_CREDIT_PACKS[code].label, credits: AI_CREDIT_PACKS[code].credits, priceMinor: AI_CREDIT_PACKS[code].amountMinor, sortOrder: i + 1 }));

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

/** A pack code from ai_credit_packs, or "custom" with an amount in rupees. Promo codes are upper-cased. */
export const creditPurchaseSchema = z
  .object({
    pack: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, "Choose a pack"),
    method: z.enum(["online", "offline"]),
    promo: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() || undefined : v), z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Promo codes are 3–30 letters, digits, _ or -").optional()),
    amount: z.preprocess(blank, z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 499 or 499.50").transform((v) => toMinor(v)).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.pack === "custom" && v.amount === undefined) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount" });
  })
  .transform((v) => ({ ...v, amount: v.pack === "custom" ? v.amount : undefined }));

export type AiCreditCatalogPack = { code: string; label: string; credits: number; priceMinor: number; sortOrder: number };
export type AiCreditCatalog = {
  /** False when the economy migration is pending (packs are then the fixed fallback, no custom/promo). */
  configurable: boolean;
  packs: AiCreditCatalogPack[];
  costs: { kind: string; label: string; credits: number }[];
  custom: { minMinor: number; maxMinor: number; creditsPerRupee: number } | null;
};

export const creditPurchaseDecisionSchema = z.object({
  requestId: z.uuid(),
  decision: z.enum(["approve", "decline"]),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(500).optional()),
  paymentReference: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(160).optional()),
});

export const creditAdjustmentSchema = z.object({
  tenantId: z.uuid(),
  credits: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "Enter a non-zero adjustment"),
  note: z.string().trim().min(3, "Give a reason of at least 3 characters").max(500),
});

/** Platform-generated AI credit codes look like OTC-1A2B3C4D5E6F (12 hex digits after the prefix). */
export const AI_CREDIT_OTC_RE = /^OTC-[0-9A-F]{12}$/;

const optionalNote = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
  z.string().max(200).optional(),
);

export const createAiCreditCodeSchema = z.object({
  credits: z.coerce.number({ error: "Enter how many credits" }).int("Whole credits only").min(1, "At least 1 credit").max(1_000_000, "At most 1,000,000 credits"),
  note: optionalNote,
});

export const revokeAiCreditCodeSchema = z.object({ codeId: z.uuid() });

/** Seller redeem: trim + upper-case so OTC-… matches the stored hash. */
export const redeemAiCreditCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(AI_CREDIT_OTC_RE, "Codes look like OTC-1A2B3C4D5E6F"),
});

export type AiCreditOtcRow = {
  id: string;
  hint: string;
  credits: number;
  status: "unused" | "redeemed" | "revoked" | string;
  redeemedTenantId: string | null;
  redeemedTenantName: string | null;
  redeemedAt: string | null;
  note: string | null;
  createdAt: string;
};

/** Friendly message for redeem_ai_credit_code() failure hints. */
export function aiCreditOtcRedeemMessage(hint: string | null | undefined, message?: string | null): string {
  if (hint === "CODE_INVALID" || /not valid|already used|CODE_INVALID/i.test(message ?? "")) {
    return "This code is not valid or was already used.";
  }
  if (/schema cache|does not exist|PGRST202|42883|42P01/i.test(message ?? "")) {
    return "AI credit codes are being set up. Please try again after the pending database migration is applied.";
  }
  return "The code could not be redeemed.";
}

/** Admin table display: OTC-…{last4}. */
export function aiCreditOtcDisplay(hint: string): string {
  return `OTC-…${hint}`;
}

export type AiCreditLedgerRow = {
  id: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  note: string | null;
  createdAt: string;
};

export type AiCreditPurchaseRow = {
  id: string;
  tenantId: string;
  /** A pack code, or "custom". */
  pack: string;
  credits: number;
  amountMinor: number;
  method: "online" | "offline";
  status: "pending" | "approved" | "declined" | "cancelled";
  decisionNote: string | null;
  paymentReference: string | null;
  createdAt: string;
  decidedAt: string | null;
};
