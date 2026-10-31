import { describe, expect, it } from "vitest";
import { buildFallbackReadyStorePlan, catalogFor } from "@/features/onboarding/seed/fallback";
import { READY_STORE_COUNTS } from "@/features/onboarding/seed/counts";
import { readyStorePlanSchema } from "@/features/onboarding/seed/schemas";
import { withSamplePrefix } from "@/features/onboarding/seed/sample-title";

describe("ready-store seed counts", () => {
  it("READY_STORE_COUNTS.products is 5", () => {
    expect(READY_STORE_COUNTS.products).toBe(5);
  });

  it("fallback plan for fashion with a brief validates with readyStorePlanSchema", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Loom & Thread",
      industry: "fashion",
      subcategory: "ethnic",
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

  it("fashion activewear fallback has 5 niche products, Sample titles, no Gold Thread jutti", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Move Studio",
      industry: "fashion",
      subcategory: "activewear",
    });
    expect(plan.products).toHaveLength(5);
    expect(READY_STORE_COUNTS.products).toBe(5);
    const titles = plan.products.map((p) => p.title);
    expect(titles.some((t) => /jutti|gold thread/i.test(t))).toBe(false);
    const prefixed = titles.map(withSamplePrefix);
    expect(prefixed.every((t) => t.startsWith("Sample "))).toBe(true);
    expect(prefixed).toEqual(titles.map((t) => (t.startsWith("Sample ") ? t : `Sample ${t}`)));
    // Activewear catalogue itself has no footwear SKUs
    const pack = catalogFor("fashion", "activewear");
    expect(pack.products).toHaveLength(5);
    expect(pack.products.some((p) => /jutti|gold thread/i.test(p.title))).toBe(false);
  });

  it("bags industry fallback only includes bag/wallet style products", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Carry Co",
      industry: "bags",
      subcategory: "handbags",
    });
    expect(plan.products).toHaveLength(5);
    for (const p of plan.products) {
      expect(/bag|wallet|trolley|pouch|backpack|organiser/i.test(p.title)).toBe(true);
      expect(/jutti/i.test(p.title)).toBe(false);
    }
  });

  it("withSamplePrefix is idempotent", () => {
    expect(withSamplePrefix("Yoga Leggings")).toBe("Sample Yoga Leggings");
    expect(withSamplePrefix("Sample Yoga Leggings")).toBe("Sample Yoga Leggings");
  });

  it("keeps a long seller brief inside theme field limits", () => {
    const brief = "Handloom cotton from Rajasthan. ".repeat(80);
    const plan = buildFallbackReadyStorePlan({
      storeName: "Kia Garments",
      industry: "fashion",
      subcategory: "ethnic",
      brief,
    });
    expect(readyStorePlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.story.length).toBeLessThanOrEqual(1500);
    for (const slide of plan.hero.slides) {
      expect(slide.subheading.length).toBeLessThanOrEqual(240);
      expect(slide.heading.length).toBeLessThanOrEqual(120);
    }
  });

  it("every product categorySlug exists on the fallback plan", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Loom & Thread",
      industry: "fashion",
      subcategory: "western",
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
