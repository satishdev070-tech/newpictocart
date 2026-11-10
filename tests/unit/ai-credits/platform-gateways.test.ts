import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { savePlatformCashfreeSchema, savePlatformPayuSchema, savePlatformRazorpaySchema } from "@/features/ai-credits/gateway-schemas";
import { APP_PROVIDERS, EXTRA_KEYS, needsClientId, saveAppCredentialSchema } from "@/features/platform-apps/core";

const MIGRATION_46 = readFileSync(new URL("../../../supabase/migrations/20261028004600_platform_ai_payment_gateways.sql", import.meta.url), "utf8");
const MIGRATION_63 = readFileSync(new URL("../../../supabase/migrations/20261103006300_platform_payu_and_plan_payments.sql", import.meta.url), "utf8");

describe("platform AI payment gateway schemas", () => {
  it("accepts Razorpay key shapes and optional webhook secret", () => {
    expect(savePlatformRazorpaySchema.parse({ keyId: "rzp_test_ABCDEFGH12", keySecret: "secretsecret" })).toEqual({
      keyId: "rzp_test_ABCDEFGH12",
      keySecret: "secretsecret",
      webhookSecret: undefined,
    });
    expect(savePlatformRazorpaySchema.parse({ keyId: "rzp_live_ABCDEFGH12", keySecret: "secretsecret", webhookSecret: "whsec_abcdefghij" }).webhookSecret).toBe("whsec_abcdefghij");
    expect(savePlatformRazorpaySchema.safeParse({ keyId: "pk_test_x", keySecret: "secretsecret" }).success).toBe(false);
  });

  it("requires Cashfree environment", () => {
    expect(savePlatformCashfreeSchema.parse({ appId: "TESTAPP123", secretKey: "secretsecret", environment: "test" })).toMatchObject({ environment: "test" });
    expect(savePlatformCashfreeSchema.safeParse({ appId: "TESTAPP123", secretKey: "secretsecret" }).success).toBe(false);
  });

  it("requires PayU merchant key, salt and environment", () => {
    expect(savePlatformPayuSchema.parse({ merchantKey: "gtKFFx", salt: "saltysalty1", environment: "test" })).toMatchObject({ environment: "test" });
    expect(savePlatformPayuSchema.safeParse({ merchantKey: "gtKFFx", salt: "saltysalty1" }).success).toBe(false);
    expect(savePlatformPayuSchema.safeParse({ merchantKey: "bad key", salt: "saltysalty1", environment: "live" }).success).toBe(false);
  });

  it("widens platform-apps registry for razorpay, cashfree and payu", () => {
    expect(APP_PROVIDERS).toEqual(expect.arrayContaining(["razorpay", "cashfree", "payu"]));
    expect(needsClientId("razorpay")).toBe(true);
    expect(needsClientId("cashfree")).toBe(true);
    expect(needsClientId("payu")).toBe(true);
    expect(EXTRA_KEYS.razorpay).toContain("webhookSecretCiphertext");
    expect(EXTRA_KEYS.cashfree).toContain("environment");
    expect(EXTRA_KEYS.payu).toContain("environment");
    expect(saveAppCredentialSchema.parse({ provider: "razorpay", clientId: "rzp_test_ABCDEFGH12", secret: "secretsecret", webhookSecret: "whsec_abcdefghij" }).webhookSecret).toBe("whsec_abcdefghij");
    expect(saveAppCredentialSchema.parse({ provider: "cashfree", clientId: "TESTAPP123", secret: "secretsecret", environment: "live" }).environment).toBe("live");
    expect(saveAppCredentialSchema.parse({ provider: "payu", clientId: "gtKFFx", secret: "saltysalty1", environment: "test" }).environment).toBe("test");
  });

  it("migration 4600 widens credentials and adds purchase provider columns + complete RPC", () => {
    expect(MIGRATION_46).toMatch(/'razorpay',\s*'cashfree'/);
    expect(MIGRATION_46).toContain("provider_order_id");
    expect(MIGRATION_46).toContain("complete_ai_credit_purchase_payment");
    expect(MIGRATION_46).toContain("grant execute on function public.complete_ai_credit_purchase_payment");
  });

  it("migration 6300 adds PayU + plan payment columns + complete plan RPC", () => {
    expect(MIGRATION_63).toMatch(/'razorpay',\s*'cashfree',\s*'payu'/);
    expect(MIGRATION_63).toContain("amount_paise");
    expect(MIGRATION_63).toContain("coupon_code");
    expect(MIGRATION_63).toContain("complete_plan_request_payment");
    expect(MIGRATION_63).toContain("grant execute on function public.complete_plan_request_payment");
  });
});
