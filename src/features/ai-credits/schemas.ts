import { z } from "zod";

export const AI_CREDIT_PACKS = {
  starter: { credits: 100, amountMinor: 9_900, label: "Starter" },
  growth: { credits: 500, amountMinor: 39_900, label: "Growth" },
  pro: { credits: 1500, amountMinor: 99_900, label: "Pro" },
} as const;

export type AiCreditPack = keyof typeof AI_CREDIT_PACKS;
export const AI_CREDIT_PACK_KEYS = Object.keys(AI_CREDIT_PACKS) as AiCreditPack[];

export const creditPurchaseSchema = z.object({
  pack: z.enum(["starter", "growth", "pro"]),
  method: z.enum(["online", "offline"]),
});

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
  pack: AiCreditPack;
  credits: number;
  amountMinor: number;
  method: "online" | "offline";
  status: "pending" | "approved" | "declined" | "cancelled";
  decisionNote: string | null;
  paymentReference: string | null;
  createdAt: string;
  decidedAt: string | null;
};
