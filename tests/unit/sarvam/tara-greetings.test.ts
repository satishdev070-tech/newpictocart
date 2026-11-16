import { describe, expect, it } from "vitest";
import { TARA_GREETING_LOCALES, taraGreetingText } from "@/features/onboarding/voice/greetings";

const SHIPPED = ["en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"];

describe("Tara greetings", () => {
  it("has a welcome and a resume line for every shipped locale", () => {
    expect([...TARA_GREETING_LOCALES].sort()).toEqual([...SHIPPED].sort());
    for (const locale of SHIPPED) {
      const welcome = taraGreetingText(locale, "welcome");
      const resume = taraGreetingText(locale, "resume");
      expect(welcome.trim().length).toBeGreaterThan(20);
      expect(resume.trim().length).toBeGreaterThan(10);
      expect(welcome).toContain("Pictocart");
      expect(welcome).not.toBe(resume);
    }
  });

  it("uses the locale's own words and falls back to English", () => {
    expect(taraGreetingText("en-IN")).toBe(
      "Namaste! Welcome to Pictocart. I'm Tara, and I'll set up your online store with you. What's your store called?",
    );
    expect(taraGreetingText("hi-IN")).toMatch(/^नमस्ते! Pictocart में आपका स्वागत है। मैं तारा हूँ/);
    expect(taraGreetingText("ur-IN")).toBe(taraGreetingText("en-IN"));
    // Non-English lines are written in their own script, not English.
    for (const locale of SHIPPED.filter((l) => l !== "en-IN")) {
      expect(taraGreetingText(locale)).toMatch(/[^\x00-\x7F]/);
    }
  });
});
