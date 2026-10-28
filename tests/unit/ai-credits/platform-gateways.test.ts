import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { savePlatformCashfreeSchema, savePlatformRazorpaySchema } from "@/features/ai-credits/gateway-schemas";
import { APP_PROVIDERS, EXTRA_KEYS, needsClientId, saveAppCredentialSchema } from "@/features/platform-apps/core";

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261028004600_platform_ai_payment_gateways.sql", import.meta.url), "utf8");

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

  it("widens platform-apps registry for razorpay and cashfree", () => {
    expect(APP_PROVIDERS).toEqual(expect.arrayContaining(["razorpay", "cashfree"]));
    expect(needsClientId("razorpay")).toBe(true);
    expect(needsClientId("cashfree")).toBe(true);
    expect(EXTRA_KEYS.razorpay).toContain("webhookSecretCiphertext");
    expect(EXTRA_KEYS.cashfree).toContain("environment");
    expect(saveAppCredentialSchema.parse({ provider: "razorpay", clientId: "rzp_test_ABCDEFGH12", secret: "secretsecret", webhookSecret: "whsec_abcdefghij" }).webhookSecret).toBe("whsec_abcdefghij");
    expect(saveAppCredentialSchema.parse({ provider: "cashfree", clientId: "TESTAPP123", secret: "secretsecret", environment: "live" }).environment).toBe("live");
  });

  it("migration widens credentials and adds purchase provider columns + complete RPC", () => {
    expect(MIGRATION).toMatch(/'razorpay',\s*'cashfree'/);
    expect(MIGRATION).toContain("provider_order_id");
    expect(MIGRATION).toContain("complete_ai_credit_purchase_payment");
    expect(MIGRATION).toContain("grant execute on function public.complete_ai_credit_purchase_payment");
  });
});
