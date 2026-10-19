import { describe, expect, it } from "vitest";
import { cleanPlanCode, onboardingHref, previousStep, progressStep, resolveStep, stepIndex } from "@/features/onboarding/steps";
import { signUpSchema } from "@/features/auth/schemas";

describe("onboarding steps", () => {
  it("forces language until a locale is chosen when no store exists", () => {
    expect(resolveStep("plan", false)).toBe("language");
    expect(resolveStep(undefined, false)).toBe("language");
    expect(resolveStep("method", false, { locale: "hi-IN" })).toBe("method");
    expect(resolveStep("voice", false, { locale: "hi-IN" })).toBe("voice");
    expect(resolveStep("business", false, { locale: "en-IN" })).toBe("business");
  });

  it("defaults to ready once a store exists (theme/plan optional)", () => {
    expect(resolveStep(undefined, true)).toBe("ready");
    expect(resolveStep("plan", true)).toBe("plan");
    expect(resolveStep("theme", true)).toBe("theme");
    expect(resolveStep("ready", true)).toBe("ready");
    expect(resolveStep("building", true)).toBe("building");
    expect(resolveStep("account", true)).toBe("ready");
    expect(resolveStep("../admin", true)).toBe("ready");
    expect(resolveStep("voice", true)).toBe("ready");
  });

  it("maps wizard screens onto the progress rail", () => {
    expect(progressStep("language")).toBe("language");
    expect(progressStep("method")).toBe("setup");
    expect(progressStep("voice")).toBe("setup");
    expect(progressStep("business")).toBe("setup");
    expect(progressStep("building")).toBe("building");
    expect(progressStep("theme")).toBe("ready");
    expect(progressStep("ready")).toBe("ready");
  });

  it("supports back navigation for the voice path", () => {
    expect(previousStep("method")).toBe("language");
    expect(previousStep("voice")).toBe("method");
    expect(previousStep("business")).toBe("method");
    expect(previousStep("building", { method: "voice" })).toBe("voice");
    expect(previousStep("building", { method: "form" })).toBe("business");
    expect(previousStep("language")).toBeNull();
    expect(stepIndex("account")).toBe(0);
    expect(stepIndex("ready")).toBe(4);
  });

  it("builds step URLs that carry plan, theme and locale", () => {
    expect(onboardingHref("language")).toBe("/onboarding");
    expect(onboardingHref("building", "t1", { plan: "growth", theme: "minimal-d2c", locale: "hi-IN" })).toBe(
      "/onboarding?step=building&store=t1&plan=growth&theme=minimal-d2c&lang=hi-IN",
    );
  });

  it("accepts only plan-code shaped values", () => {
    expect(cleanPlanCode("growth")).toBe("growth");
    expect(cleanPlanCode("Growth")).toBeNull();
    expect(cleanPlanCode("<script>")).toBeNull();
    expect(cleanPlanCode(42)).toBeNull();
  });
});

describe("sign-up carries marketing choices", () => {
  const base = { displayName: "Asha", email: "asha@example.com", password: "a-long-pass-1", storeName: "Asha Crafts" };
  it("keeps valid plan/theme codes and silently drops malformed ones", () => {
    expect(signUpSchema.parse({ ...base, plan: "growth", theme: "minimal-d2c" })).toMatchObject({ plan: "growth", theme: "minimal-d2c" });
    const bad = signUpSchema.parse({ ...base, plan: "DROP TABLE", theme: "x" });
    expect(bad.plan).toBeUndefined();
    expect(bad.theme).toBeUndefined();
  });
});
