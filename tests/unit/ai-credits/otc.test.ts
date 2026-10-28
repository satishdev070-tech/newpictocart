import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_OTC_RE,
  aiCreditOtcDisplay,
  aiCreditOtcRedeemMessage,
  createAiCreditCodeSchema,
  redeemAiCreditCodeSchema,
  revokeAiCreditCodeSchema,
} from "@/features/ai-credits/schemas";

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261028004500_ai_credit_one_time_codes.sql", import.meta.url), "utf8");

describe("AI credit OTC schemas", () => {
  it("create: positive integer credits and optional note", () => {
    expect(createAiCreditCodeSchema.parse({ credits: "250" })).toEqual({ credits: 250, note: undefined });
    expect(createAiCreditCodeSchema.parse({ credits: "100", note: " Launch pack " })).toEqual({ credits: 100, note: "Launch pack" });
    expect(createAiCreditCodeSchema.safeParse({ credits: "0" }).success).toBe(false);
    expect(createAiCreditCodeSchema.safeParse({ credits: "1000001" }).success).toBe(false);
    expect(createAiCreditCodeSchema.safeParse({ credits: "12.5" }).success).toBe(false);
  });

  it("redeem: normalises to upper case OTC- + 12 hex digits", () => {
    expect(redeemAiCreditCodeSchema.parse({ code: " otc-1a2b3c4d5e6f " }).code).toBe("OTC-1A2B3C4D5E6F");
    expect(AI_CREDIT_OTC_RE.test("OTC-1A2B3C4D5E6F")).toBe(true);
    expect(redeemAiCreditCodeSchema.safeParse({ code: "OTC-123" }).success).toBe(false);
    expect(redeemAiCreditCodeSchema.safeParse({ code: "PARTNER-1A2B3C4D5E6F" }).success).toBe(false);
    expect(redeemAiCreditCodeSchema.safeParse({ code: "OTC-1A2B3C4D5E6G" }).success).toBe(false);
  });

  it("revoke: requires a code id", () => {
    expect(revokeAiCreditCodeSchema.safeParse({ codeId: "00000000-0000-4000-8000-000000000001" }).success).toBe(true);
    expect(revokeAiCreditCodeSchema.safeParse({ codeId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("AI credit OTC redeem rules", () => {
  it("maps CODE_INVALID and migration-pending failures to seller-facing copy", () => {
    expect(aiCreditOtcRedeemMessage("CODE_INVALID")).toBe("This code is not valid or was already used.");
    expect(aiCreditOtcRedeemMessage(null, "This code is not valid or was already used.")).toBe("This code is not valid or was already used.");
    expect(aiCreditOtcRedeemMessage(null, "Could not find the function public.redeem_ai_credit_code in the schema cache")).toMatch(/pending database migration/);
    expect(aiCreditOtcRedeemMessage(null, "something else")).toBe("The code could not be redeemed.");
  });

  it("displays only the OTC prefix and last4 hint (never a full code)", () => {
    expect(aiCreditOtcDisplay("A1B2")).toBe("OTC-…A1B2");
  });
});

describe("AI credit OTC migration contracts", () => {
  it("stores hash + last4 only, statuses unused/redeemed/revoked, ledger kind otc_redeem", () => {
    expect(MIGRATION).toContain("create table if not exists public.ai_credit_one_time_codes");
    expect(MIGRATION).toContain("code_hash text not null unique");
    expect(MIGRATION).toContain("code_hint text not null");
    expect(MIGRATION).not.toMatch(/\bfull_code\b|\braw_code\b/);
    expect(MIGRATION).not.toMatch(/code_plaintext|plaintext_code/);
    expect(MIGRATION).toContain("'unused', 'redeemed', 'revoked'");
    expect(MIGRATION).toContain("'otc_redeem'");
    expect(MIGRATION).toContain("v_code := 'OTC-' ||");
    expect(MIGRATION).toContain("encode(extensions.digest(v_code, 'sha256'), 'hex')");
    expect(MIGRATION).toContain("billing.manage");
    expect(MIGRATION).toContain("platform_create_ai_credit_code");
    expect(MIGRATION).toContain("platform_list_ai_credit_codes");
    expect(MIGRATION).toContain("platform_revoke_ai_credit_code");
    expect(MIGRATION).toContain("redeem_ai_credit_code");
  });
});
