import { describe, expect, it } from "vitest";
import { cleanCode, CODE_LENGTH } from "@/components/auth/email-code-flow";
import { nextPercent } from "@/features/theme/site-builder/components/canvas-frame";
import { previousStep, progressStep, resolveStep } from "@/features/onboarding/steps";
import { renderAuthEmail } from "@/features/notifications/email/account-templates";

const brand = { storeName: "Pictocart", logoUrl: "https://pictocartdev.in/pictocart-logo.png", storeUrl: "https://pictocartdev.in", accent: "#f97316", supportEmail: null };

describe("6-box verification code", () => {
  it("keeps digits only, at most six (paste of '855 189')", () => {
    expect(CODE_LENGTH).toBe(6);
    expect(cleanCode("855 189")).toBe("855189");
    expect(cleanCode("12-34-56-78")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
});

describe("builder update progress", () => {
  it("eases towards 92% and never passes it before the canvas answers", () => {
    let p = 6;
    for (let i = 0; i < 200; i++) p = nextPercent(p);
    expect(p).toBe(92);
    expect(nextPercent(6)).toBeGreaterThan(6);
  });
});

describe("onboarding: 'What are you building?' comes first", () => {
  it("asks the site type before language when no mode is chosen", () => {
    expect(resolveStep(undefined, false, { needsType: true })).toBe("type");
    expect(resolveStep("method", false, { locale: "en-IN", needsType: true })).toBe("type");
    expect(resolveStep("type", false, { locale: "en-IN" })).toBe("type");
    expect(resolveStep(undefined, false, { needsType: false })).toBe("language");
    expect(resolveStep("type", true)).toBe("ready");
    expect(previousStep("language")).toBe("type");
    expect(previousStep("type")).toBeNull();
    expect(progressStep("type")).toBe("setup");
  });
});

describe("auth code emails", () => {
  it("leads with the code for sign-up, sign-in and reset emails", () => {
    const signup = renderAuthEmail({ action: "signup", brand, actionUrl: "https://pictocartdev.in/auth/callback?token_hash=x&type=email", otp: "855189" });
    expect(signup.subject).toBe("855189 is your Pictocart verification code");
    expect(signup.html).toContain("855189");
    expect(signup.html).toContain("60 minutes");
    expect(signup.html).toContain("pictocart-logo.png");
    expect(signup.text).toContain("Your code: 855189");
    expect(renderAuthEmail({ action: "magiclink", brand, actionUrl: null, otp: "123456" }).subject).toBe("123456 is your Pictocart sign-in code");
    expect(renderAuthEmail({ action: "recovery", brand, actionUrl: null, otp: "123456" }).subject).toBe("123456 is your Pictocart password reset code");
  });

  it("keeps the link-only copy when there is no code", () => {
    expect(renderAuthEmail({ action: "signup", brand, actionUrl: "https://pictocartdev.in/x", otp: null }).subject).toBe("Confirm your email for Pictocart");
  });
});
