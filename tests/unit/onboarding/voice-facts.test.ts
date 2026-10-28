import { describe, expect, it } from "vitest";
import {
  EMPTY_FACTS,
  factsComplete,
  mapCategoryInput,
  mapCategoryToIndustry,
  mapSiteMode,
  mergeFacts,
  missingFactLabels,
  suggestSlugFromName,
  suggestSubcategory,
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

  it("maps free-text category to industry and suggests subcategory when possible", () => {
    expect(mapCategoryInput("fashion")).toEqual({ category: "fashion", subcategory: null });
    expect(mapCategoryInput("clothing")).toEqual({ category: "fashion", subcategory: null });
    expect(mapCategoryInput("ethnic wear")).toEqual({ category: "fashion", subcategory: "ethnic" });
    expect(mapCategoryInput("ethnic clothing")).toEqual({ category: "fashion", subcategory: "ethnic" });
    expect(mapCategoryInput("skincare")).toEqual({ category: "beauty", subcategory: "skincare" });
    expect(mapCategoryInput("makeup")).toEqual({ category: "beauty", subcategory: "makeup" });
    expect(mapCategoryInput("western wear")).toEqual({ category: "fashion", subcategory: "western" });
    expect(mapCategoryInput("")).toEqual({ category: null, subcategory: null });
  });

  it("suggests subcategory within a known industry", () => {
    expect(suggestSubcategory("fashion", "ethnic")).toBe("ethnic");
    expect(suggestSubcategory("fashion", "Ethnic wear")).toBe("ethnic");
    expect(suggestSubcategory("fashion", "fashion")).toBeNull();
    expect(suggestSubcategory("beauty", "haircare")).toBe("haircare");
    expect(suggestSubcategory("grocery", "spices")).toBe("spices");
  });

  it("maps site mode phrases", () => {
    expect(mapSiteMode("ecommerce")).toBe("ecommerce");
    expect(mapSiteMode("informative")).toBe("informative");
    expect(mapSiteMode("I want to sell online")).toBe("ecommerce");
    expect(mapSiteMode("just a portfolio website")).toBe("informative");
    expect(mapSiteMode("")).toBeNull();
  });

  it("merges facts without wiping known values with empties", () => {
    const base = mergeFacts(EMPTY_FACTS, {
      name: "Asha Crafts",
      category: "handicrafts",
      subcategory: "textiles",
    });
    const next = mergeFacts(base, {
      name: "",
      siteMode: "ecommerce",
      productsServices: "Block-print cushion covers",
      tagline: "Handmade in Jaipur",
    });
    expect(next).toEqual({
      name: "Asha Crafts",
      category: "handicrafts",
      subcategory: "textiles",
      productsServices: "Block-print cushion covers",
      siteMode: "ecommerce",
      tagline: "Handmade in Jaipur",
      city: null,
    });
    expect(factsComplete(next)).toBe(true);
    expect(missingFactLabels(mergeFacts(EMPTY_FACTS, { name: "Asha Crafts", category: "handicrafts" }))).toContain(
      "subcategory",
    );
  });

  it("requires name, category, and subcategory for completion", () => {
    expect(factsComplete(mergeFacts(EMPTY_FACTS, { name: "A", category: "fashion", siteMode: "ecommerce" }))).toBe(
      false,
    );
    expect(
      factsComplete(mergeFacts(EMPTY_FACTS, { name: "A", category: "fashion", subcategory: "ethnic" })),
    ).toBe(true);
  });

  it("suggests a store slug from the business name", () => {
    expect(suggestSlugFromName("Asha Crafts")).toBe("asha-crafts");
    expect(suggestSlugFromName("  Café  Nucléaire!! ")).toBe("cafe-nucleaire");
  });
});
