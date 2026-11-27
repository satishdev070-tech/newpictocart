import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allowDevCode,
  claimStatusMessage,
  missingStep,
  sendPhoneCodeSchema,
  showClaimCard,
  toClaimResult,
  toVerifyResult,
  verifyPhoneCodeSchema,
  verifyResultMessage,
  VERIFICATION_BONUS_CREDITS,
  type VerificationStatus,
} from "@/features/verification/schemas";
import { APP_PROVIDERS, buildWhatsappOtpPayload, EXTRA_KEYS, needsClientId, resolveCredential, saveAppCredentialSchema, toStatus, whatsappOtpSender, WHATSAPP_OTP_DEFAULTS } from "@/features/platform-apps/core";
import { setupGuides } from "@/features/platform-apps/setup";

const status = (over: Partial<VerificationStatus> = {}): VerificationStatus => ({ email: "a@b.in", emailVerified: false, phone: null, phoneVerified: false, reward: null, ...over });

describe("verification status → missing step", () => {
  it("names the missing step", () => {
    expect(missingStep(status())).toBe("both");
    expect(missingStep(status({ phoneVerified: true }))).toBe("email");
    expect(missingStep(status({ emailVerified: true }))).toBe("phone");
    expect(missingStep(status({ emailVerified: true, phoneVerified: true }))).toBeNull();
  });

  it("shows the claim card to owners only, until claimed, and never without the migration", () => {
    expect(showClaimCard(status(), true)).toBe(true);
    expect(showClaimCard(status(), false)).toBe(false);
    expect(showClaimCard(status({ reward: { credits: 250, createdAt: "2026-11-27T00:00:00Z" } }), true)).toBe(false);
    expect(showClaimCard(null, true)).toBe(false);
  });
});

describe("schemas", () => {
  it("normalises the phone to E.164", () => {
    expect(sendPhoneCodeSchema.parse({ phone: "98765 43210" })).toEqual({ phone: "+919876543210" });
    expect(sendPhoneCodeSchema.safeParse({ phone: "12345" }).success).toBe(false);
  });

  it("accepts exactly 6 digits (spaces ignored)", () => {
    expect(verifyPhoneCodeSchema.parse({ phone: "+919876543210", code: " 123 456 " })).toEqual({ phone: "+919876543210", code: "123456" });
    for (const code of ["12345", "1234567", "12a456", ""]) expect(verifyPhoneCodeSchema.safeParse({ phone: "+919876543210", code }).success).toBe(false);
  });

  it("maps RPC results safely", () => {
    expect(toVerifyResult("verified")).toBe("verified");
    expect(toVerifyResult("bogus")).toBe("none");
    expect(verifyResultMessage("verified")).toBeNull();
    expect(verifyResultMessage("locked")).toMatch(/new code/);
    expect(toClaimResult({ status: "claimed", credits: 250, balance: 300 })).toEqual({ status: "claimed", credits: 250, balance: 300 });
    expect(toClaimResult(null).status).toBe("not_owner");
    expect(claimStatusMessage("claimed", 250)).toContain("250");
    expect(VERIFICATION_BONUS_CREDITS).toBe(250);
  });
});

describe("dev-code gating", () => {
  it("shows the code only on a localhost platform with no sender", () => {
    expect(allowDevCode(false, "localhost")).toBe(true);
    expect(allowDevCode(false, " LOCALHOST ")).toBe(true);
    expect(allowDevCode(true, "localhost")).toBe(false);
    expect(allowDevCode(false, "pictocart.in")).toBe(false);
    expect(allowDevCode(false, "localhost.pictocart.in")).toBe(false);
    expect(allowDevCode(false, undefined)).toBe(false);
  });
});

describe("platform WhatsApp sender", () => {
  it("is a platform app with phone number ID + token and template settings", () => {
    expect(APP_PROVIDERS).toContain("whatsapp");
    expect(needsClientId("whatsapp")).toBe(true);
    expect(EXTRA_KEYS.whatsapp).toEqual(["templateName", "templateLanguage"]);
    expect(saveAppCredentialSchema.parse({ provider: "whatsapp", clientId: "123456789012345", templateName: "pictocart_otp", templateLanguage: "en_US" })).toMatchObject({ templateName: "pictocart_otp", templateLanguage: "en_US" });
    expect(saveAppCredentialSchema.safeParse({ provider: "whatsapp", templateName: "Bad Name" }).success).toBe(false);
    expect(saveAppCredentialSchema.safeParse({ provider: "whatsapp", templateLanguage: "english" }).success).toBe(false);
    expect(setupGuides("https://pictocart.in").find((g) => g.provider === "whatsapp")?.steps.join(" ")).toMatch(/AUTHENTICATION/);
  });

  it("fills template defaults and exposes only non-secret settings", () => {
    const cred = resolveCredential("whatsapp", null, (x) => x, { PLATFORM_WHATSAPP_PHONE_NUMBER_ID: "1098765", PLATFORM_WHATSAPP_ACCESS_TOKEN: "EAAG-secret-token-123" });
    expect(whatsappOtpSender(cred)).toEqual({ phoneNumberId: "1098765", token: "EAAG-secret-token-123", templateName: WHATSAPP_OTP_DEFAULTS.templateName, templateLanguage: "en" });
    expect(whatsappOtpSender(null)).toBeNull();
    const row = { client_id: "1098765", secret_ciphertext: "EAAG-db-token-123456", extra: { templateName: "my_otp", other: "x" } };
    const s = toStatus("whatsapp", resolveCredential("whatsapp", row, (x) => x, {}), row);
    expect(s.settings).toEqual({ templateName: "my_otp" });
    expect(JSON.stringify(s)).not.toContain("EAAG-db-token");
  });

  it("builds Meta's authentication template payload (body + copy-code button = code)", () => {
    const p = buildWhatsappOtpPayload("+919876543210", "042137", "pictocart_otp", "en");
    expect(p.to).toBe("919876543210");
    expect(p.template).toEqual({
      name: "pictocart_otp",
      language: { code: "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "042137" }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "042137" }] },
      ],
    });
  });
});

describe("migration 9200 grants", () => {
  const sql = readFileSync("supabase/migrations/20261127009200_verification_reward.sql", "utf8");
  it("grants svc_start_phone_verification to service_role only", () => {
    expect(sql).toMatch(/revoke all on function public\.svc_start_phone_verification\(uuid, text\) from public, anon, authenticated;/);
    const grants = [...sql.matchAll(/grant execute on function public\.svc_start_phone_verification\(uuid, text\) to ([^;]+);/g)].map((m) => (m[1] ?? "").trim());
    expect(grants).toEqual(["service_role"]);
  });
  it("lets signed-in users verify and claim (not anon)", () => {
    expect(sql).toMatch(/grant execute on function public\.verify_phone_code\(text, text\) to authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.claim_verification_bonus\(uuid\) to authenticated;/);
    expect(sql).not.toMatch(/grant execute on function public\.\w+\([^)]*\) to [^;]*anon/);
  });
});
