import { describe, expect, it } from "vitest";
import { buildFallbackReadyStorePlan } from "@/features/onboarding/seed/fallback";
import { READY_STORE_COUNTS } from "@/features/onboarding/seed/counts";
import { readyStorePlanSchema } from "@/features/onboarding/seed/schemas";

describe("ready-store seed counts", () => {
  it("fallback plan for fashion with a brief validates with readyStorePlanSchema", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Loom & Thread",
      industry: "fashion",
      brief: "Handloom cotton kurtas sourced from weavers in Rajasthan.",
    });
    const parsed = readyStorePlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
    expect(plan.categories).toHaveLength(READY_STORE_COUNTS.categories);
    expect(plan.products).toHaveLength(READY_STORE_COUNTS.products);
    expect(plan.blogs).toHaveLength(READY_STORE_COUNTS.blogs);
    expect(plan.testimonials).toHaveLength(READY_STORE_COUNTS.testimonials);
    expect(plan.story).toContain("Rajasthan");
  });

  it("every product categorySlug exists on the fallback plan", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Loom & Thread",
      industry: "fashion",
    });
    const catSlugs = new Set(plan.categories.map((c) => c.slug));
    for (const p of plan.products) {
      expect(catSlugs.has(p.categorySlug)).toBe(true);
    }
    const productSlugs = plan.products.map((p) => p.slug);
    expect(new Set(productSlugs).size).toBe(productSlugs.length);
  });

  it("rejects a plan with only four categories", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Test Shop",
      industry: "electronics",
    });
    const invalid = {
      ...plan,
      categories: plan.categories.slice(0, 4),
    };
    const parsed = readyStorePlanSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
