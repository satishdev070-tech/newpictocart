import { describe, expect, it } from "vitest";
import { assertDefaultBusinessCoachTipCount, DEFAULT_BUSINESS_COACH_TIP_COUNT, defaultBusinessCoachTips } from "@/features/seller-ai/default-coach-tips";

describe("default Business Coach tips", () => {
  it("ships exactly five free starter tips in EN and HI", () => {
    expect(DEFAULT_BUSINESS_COACH_TIP_COUNT).toBe(5);
    for (const locale of ["en", "hi"] as const) {
      const defaults = defaultBusinessCoachTips(locale);
      expect(assertDefaultBusinessCoachTipCount(locale)).toBe(5);
      expect(defaults.tips).toHaveLength(5);
      expect(defaults.headline.length).toBeGreaterThan(0);
      expect(defaults.focus.length).toBeGreaterThan(0);
      for (const tip of defaults.tips) {
        expect(tip.title.length).toBeGreaterThan(0);
        expect(tip.detail.length).toBeGreaterThan(0);
        expect(["high", "medium", "low"]).toContain(tip.priority);
      }
    }
  });
});
