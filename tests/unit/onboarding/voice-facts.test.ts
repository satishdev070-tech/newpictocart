import { describe, expect, it } from "vitest";
import {
  EMPTY_FACTS,
  confirmationReady,
  extractFactsFromText,
  factsComplete,
  normalizeFacts,
  parseVoiceFactsJson,
  resolveFactLists,
  toConfirmedFacts,
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
      categories: ["handicrafts"],
      subcategories: ["textiles"],
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

describe("multi-category voice facts", () => {
  it("extracts several product types and the city from one sentence", () => {
    const patch = extractFactsFromText("I sell fashion jewellery and bridal sets in Noida");
    expect(patch).toEqual({ categories: ["jewellery"], subcategories: ["imitation", "bridal"], city: "Noida" });
    const facts = mergeFacts({ ...EMPTY_FACTS, name: "Glow Box" }, patch);
    expect(facts.category).toBe("jewellery");
    expect(facts.subcategory).toBe("imitation");
    expect(facts.subcategories).toEqual(["imitation", "bridal"]);
    expect(facts.city).toBe("Noida");
  });

  it("splits on commas / aur and spans industries", () => {
    const patch = extractFactsFromText("We sell ethnic wear, skincare aur makeup");
    expect(patch.categories).toEqual(["fashion", "beauty"]);
    expect(patch.subcategories).toEqual(["ethnic", "skincare", "makeup"]);
    expect(patch.city).toBeUndefined();
  });

  it("resolves model lists to slugs, keeping unknown niches as custom labels", () => {
    expect(resolveFactLists(["Jewellery"], ["Fashion jewellery", "bridal", "handmade anklets"])).toEqual({
      categories: ["jewellery"],
      subcategories: ["imitation", "bridal", "Handmade anklets"],
    });
    // A niche alone recovers its industry.
    expect(resolveFactLists([], ["skincare"])).toEqual({ categories: ["beauty"], subcategories: ["skincare"] });
    // Bare industry names are not product types.
    expect(resolveFactLists(["fashion"], ["fashion"]).subcategories).toEqual([]);
  });

  it("unions lists across turns, mirrors scalars to the first item and caps sizes", () => {
    const a = mergeFacts(EMPTY_FACTS, { categories: ["jewellery"], subcategories: ["imitation"] });
    const b = mergeFacts(a, { categories: ["fashion"], subcategories: ["ethnic", "imitation"] });
    expect(b.categories).toEqual(["jewellery", "fashion"]);
    expect(b.subcategories).toEqual(["imitation", "ethnic"]);
    expect(b.category).toBe("jewellery");
    expect(b.subcategory).toBe("imitation");

    const many = mergeFacts(EMPTY_FACTS, {
      categories: ["fashion", "beauty", "jewellery", "grocery"],
      subcategories: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
    });
    expect(many.categories).toHaveLength(3);
    expect(many.subcategories).toHaveLength(8);
  });

  it("puts a patched scalar category first and drops known slugs of removed industries", () => {
    const prev = mergeFacts(EMPTY_FACTS, { category: "fashion", subcategory: "ethnic" });
    const next = mergeFacts(prev, { category: "jewellery", subcategory: "bridal" });
    expect(next.category).toBe("jewellery");
    expect(next.categories).toEqual(["jewellery", "fashion"]);
    expect(next.subcategory).toBe("bridal");

    const trimmed = normalizeFacts({ ...next, categories: ["jewellery"], category: null, subcategory: null });
    expect(trimmed.subcategories).toEqual(["bridal"]);
  });

  it("accepts older facts without lists", () => {
    const legacy = { name: "Asha", category: "fashion" as const, subcategory: "ethnic", productsServices: null, siteMode: null, tagline: null, city: null };
    expect(normalizeFacts(legacy)).toMatchObject({ categories: ["fashion"], subcategories: ["ethnic"] });
    expect(factsComplete(legacy)).toBe(true);
  });

  it("parses client facts JSON with lists and scalars", () => {
    const facts = parseVoiceFactsJson(
      JSON.stringify({ name: "Glow Box", categories: ["jewellery", "nonsense"], subcategories: ["imitation", "Bridal sets"], city: "Noida" }),
    );
    expect(facts).toMatchObject({
      name: "Glow Box",
      category: "jewellery",
      categories: ["jewellery"],
      subcategories: ["imitation", "bridal"],
      subcategory: "imitation",
      city: "Noida",
    });
    expect(parseVoiceFactsJson("{bad")).toEqual(EMPTY_FACTS);
    expect(parseVoiceFactsJson(JSON.stringify({ category: "clothing", subcategory: "ethnic wear" }))).toMatchObject({
      category: "fashion",
      subcategory: "ethnic",
      categories: ["fashion"],
      subcategories: ["ethnic"],
    });
  });

  it("is ready to confirm once name + a category + a product type are known", () => {
    expect(confirmationReady(EMPTY_FACTS)).toBe(false);
    expect(confirmationReady(mergeFacts(EMPTY_FACTS, { name: "Glow Box", categories: ["jewellery"] }))).toBe(false);
    expect(confirmationReady(mergeFacts(EMPTY_FACTS, { categories: ["jewellery"], subcategories: ["bridal"] }))).toBe(false);
    expect(confirmationReady(mergeFacts(EMPTY_FACTS, { name: "  ", categories: ["jewellery"], subcategories: ["bridal"] }))).toBe(false);
    const ready = mergeFacts(EMPTY_FACTS, { name: "Glow Box", categories: ["jewellery"], subcategories: ["bridal"] });
    expect(confirmationReady(ready)).toBe(true);
    expect(toConfirmedFacts({ ...ready, name: " Glow Box ", city: " " })).toEqual({
      name: "Glow Box",
      categories: ["jewellery"],
      subcategories: ["bridal"],
      city: null,
      tagline: null,
    });
  });
});
