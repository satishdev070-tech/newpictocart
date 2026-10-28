import { describe, expect, it } from "vitest";
import {
  EMPTY_FACTS,
  factsComplete,
  mapCategoryToIndustry,
  mapSiteMode,
  mergeFacts,
  missingFactLabels,
  suggestSlugFromName,
} from "@/features/onboarding/voice/facts";

describe("voice fact mapping", () => {
  it("maps common aliases to industry slugs", () => {
    expect(mapCategoryToIndustry("clothing")).toBe("fashion");
    expect(mapCategoryToIndustry("Jewellery")).toBe("jewellery");
    expect(mapCategoryToIndustry("home decor")).toBe("home-decor");
    expect(mapCategoryToIndustry("bakery")).toBe("gourmet");
    expect(mapCategoryToIndustry("ayurveda")).toBe("ayurveda");
    expect(mapCategoryToIndustry("fashion")).toBe("fashion");
    expect(mapCategoryToIndustry("not-a-real-category")).toBeNull();
  });

  it("maps site mode phrases", () => {
    expect(mapSiteMode("ecommerce")).toBe("ecommerce");
    expect(mapSiteMode("informative")).toBe("informative");
    expect(mapSiteMode("I want to sell online")).toBe("ecommerce");
    expect(mapSiteMode("just a portfolio website")).toBe("informative");
    expect(mapSiteMode("")).toBeNull();
  });

  it("merges facts without wiping known values with empties", () => {
    const base = mergeFacts(EMPTY_FACTS, { name: "Asha Crafts", category: "handicrafts" });
    const next = mergeFacts(base, { name: "", siteMode: "ecommerce", tagline: "Handmade in Jaipur" });
    expect(next).toEqual({
      name: "Asha Crafts",
      category: "handicrafts",
      subcategory: null,
      productsServices: null,
      siteMode: "ecommerce",
      tagline: "Handmade in Jaipur",
      city: null,
    });
    expect(factsComplete(next)).toBe(true);
    expect(missingFactLabels(base)).toContain("website or online store");
  });

  it("suggests a store slug from the business name", () => {
    expect(suggestSlugFromName("Asha Crafts")).toBe("asha-crafts");
    expect(suggestSlugFromName("  Café  Nucléaire!! ")).toBe("cafe-nucleaire");
  });
});
