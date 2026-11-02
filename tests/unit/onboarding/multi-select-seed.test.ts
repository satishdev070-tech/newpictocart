import { describe, expect, it } from "vitest";
import {
  buildFallbackReadyStorePlan,
  catalogFor,
  collectSelectionLabels,
  resolveNicheLabel,
} from "@/features/onboarding/seed/fallback";
import { READY_STORE_COUNTS } from "@/features/onboarding/seed/counts";

describe("multi-select → seed categories", () => {
  it("collects primary + sub: extras + customs as labels (≤5)", () => {
    const labels = collectSelectionLabels(
      "fashion",
      "ethnic",
      "sub:activewear,Bandhani,western,mens,fusion,kids-wear",
    );
    expect(labels).toEqual([
      "Ethnic wear",
      "Activewear",
      "Bandhani",
      "Western wear",
      "Men's clothing",
    ]);
    expect(labels).toHaveLength(READY_STORE_COUNTS.categories);
  });

  it("maps multi-select into distinct seeded categories with matching products", () => {
    const plan = buildFallbackReadyStorePlan({
      storeName: "Kia Studio",
      industry: "fashion",
      subcategory: "ethnic",
      niche: "sub:activewear,Bandhani",
    });
    expect(plan.categories).toHaveLength(READY_STORE_COUNTS.categories);
    expect(plan.products).toHaveLength(READY_STORE_COUNTS.products);
    const names = plan.categories.map((c) => c.name);
    expect(names.slice(0, 3)).toEqual(["Ethnic wear", "Activewear", "Bandhani"]);
    for (const p of plan.products) {
      const cat = plan.categories.find((c) => c.slug === p.categorySlug);
      expect(cat).toBeTruthy();
      expect(p.title.toLowerCase()).toContain(cat!.name.toLowerCase());
    }
  });

  it("keeps specialised fashion pack for a single known subcategory", () => {
    const pack = catalogFor("fashion", "activewear");
    expect(pack.products.some((p) => /yoga|training|leggings/i.test(p.title))).toBe(true);
    expect(pack.categories[0]?.name).not.toBe("Activewear");
  });

  it("uses niche-named categories for a single custom type", () => {
    const pack = catalogFor("fashion", "Bandhani", null);
    expect(pack.categories[0]?.name).toContain("Bandhani");
    expect(pack.products.some((p) => /Bandhani/i.test(p.title))).toBe(true);
  });

  it("resolveNicheLabel joins multi-select for display", () => {
    expect(resolveNicheLabel("beauty", "skincare", "sub:makeup")).toBe("Skincare · Makeup");
  });
});
