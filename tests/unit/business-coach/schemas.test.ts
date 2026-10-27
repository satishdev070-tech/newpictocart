import { describe, expect, it } from "vitest";
import { businessCoachInput, businessCoachOutput } from "@/features/business-coach/schemas";
import { findFeature } from "@/features/ai-health/registry";

describe("business coach schemas", () => {
  it("defaults focus to auto and accepts a tip set", () => {
    expect(businessCoachInput.parse({})).toEqual({ focus: "auto" });
    const out = businessCoachOutput.parse({
      headline: "Tighten fulfilment this week",
      focus: "Pack the two open orders before adding more SKUs.",
      tips: [
        { title: "Ship open orders", detail: "Two confirmed orders are still unfulfilled.", priority: "high" },
        { title: "Add photos", detail: "Draft products without images convert poorly.", priority: "medium" },
      ],
    });
    expect(out.tips).toHaveLength(2);
    expect(out.tips[0]?.priority).toBe("high");
  });

  it("rejects empty tips and is registered for credits", () => {
    expect(businessCoachOutput.safeParse({ headline: "x", focus: "y", tips: [] }).success).toBe(false);
    const f = findFeature("business_coach");
    expect(f?.creditKind).toBe("business_coach");
    expect(f?.routable).toBe(true);
  });
});
