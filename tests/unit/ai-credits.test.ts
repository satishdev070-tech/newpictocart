import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_CREDIT_PACKS, creditAdjustmentSchema, creditPurchaseSchema } from "@/features/ai-credits/schemas";

const MIGRATION = readFileSync(new URL("../../supabase/migrations/20261019003400_ai_credits.sql", import.meta.url), "utf8");

describe("AI credits contracts", () => {
  it("keeps the seller pack contract aligned with the database purchase function", () => {
    for (const [key, pack] of Object.entries(AI_CREDIT_PACKS)) {
      expect(creditPurchaseSchema.safeParse({ pack: key, method: "online" }).success).toBe(true);
      expect(MIGRATION).toContain(`when '${key}' then v_credits := ${pack.credits}; v_amount := ${pack.amountMinor / 100}`);
    }
  });

  it("creates a one-time 100-credit signup grant and protects balances with locking RPCs", () => {
    expect(MIGRATION).toContain("values (new.id, 100)");
    expect(MIGRATION).toContain("kind = 'signup_bonus'");
    expect(MIGRATION).toContain("for update");
    expect(MIGRATION).toContain("AI_CREDITS_EXHAUSTED");
    expect(MIGRATION).toContain("kind = 'usage_refund'");
  });

  it("rejects zero or unreasonably large manual adjustments", () => {
    expect(creditAdjustmentSchema.safeParse({ tenantId: "00000000-0000-4000-8000-000000000001", credits: 0, note: "Adjustment" }).success).toBe(false);
    expect(creditAdjustmentSchema.safeParse({ tenantId: "00000000-0000-4000-8000-000000000001", credits: 1_000_001, note: "Adjustment" }).success).toBe(false);
    expect(creditAdjustmentSchema.safeParse({ tenantId: "00000000-0000-4000-8000-000000000001", credits: -20, note: "Reversal" }).success).toBe(true);
  });
});
