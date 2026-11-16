import { describe, expect, it } from "vitest";
import {
  applyStoreFacts,
  compatSubcategoryFields,
  storeFactsComplete,
  storeFactsFromDraft,
} from "@/features/start/draft/apply-facts";
import {
  draftCategories,
  draftSeedSubcategory,
  draftSubcategories,
  emptyStartDraft,
  parseStartDraft,
} from "@/features/start/draft/schema";
import { businessComplete, voiceFactsComplete } from "@/features/start/flow";

type Loose = {
  v: number;
  screen: string;
  business: Record<string, unknown>;
  voice: { facts: Record<string, unknown> };
};

const facts = {
  name: "  Noida Gems ",
  categories: ["jewellery", "fashion", "nope"],
  subcategories: ["imitation", "bridal", "ethnic", "Temple pieces"],
  city: "Noida",
};

describe("applyStoreFacts", () => {
  it("writes multi-select fields and mirrors the legacy single fields", () => {
    const d = applyStoreFacts(emptyStartDraft(), facts);
    expect(d.business.name).toBe("Noida Gems");
    expect(d.business.categories).toEqual(["jewellery", "fashion"]);
    expect(d.business.category).toBe("jewellery");
    expect(d.business.subcategories).toEqual(["imitation", "bridal", "ethnic", "Temple pieces"]);
    expect(d.business.subcategory).toBe("imitation");
    // Primary-category slugs stay slugs; other categories' slugs become labels for the seed.
    expect(d.business.productsServices).toBe("sub:bridal,Ethnic wear,Temple pieces");
    expect(d.business.siteMode).toBe("ecommerce");
    expect(d.business.city).toBe("Noida");
    expect(d.voice.facts.categories).toEqual(d.business.categories);
    expect(d.voice.facts.subcategories).toEqual(d.business.subcategories);
    expect(d.voice.facts.category).toBe("jewellery");
    expect(draftSeedSubcategory(d)).toBe("imitation");
    expect(businessComplete(d)).toBe(true);
    expect(voiceFactsComplete(d)).toBe(true);
    expect(parseStartDraft(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it("produces identical drafts for quiz and voice (same pure function)", () => {
    const base = emptyStartDraft({ locale: "hi-IN" });
    expect(applyStoreFacts(base, facts)).toEqual(applyStoreFacts(base, { ...facts }));
  });

  it("clamps to 3 categories and 8 product types, dedupes, strips commas from customs", () => {
    const d = applyStoreFacts(emptyStartDraft(), {
      name: "X Store",
      categories: ["fashion", "jewellery", "beauty", "grocery", "fashion"],
      subcategories: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "A", "x,y"],
      city: null,
    });
    expect(d.business.categories).toEqual(["fashion", "jewellery", "beauty"]);
    expect(d.business.subcategories).toHaveLength(8);
    const d2 = applyStoreFacts(emptyStartDraft(), { name: "X", categories: ["fashion"], subcategories: ["x,y"], city: null });
    expect(d2.business.subcategories).toEqual(["x y"]);
  });

  it("mirrors a custom label (or another category's label) when the primary has no known slug", () => {
    expect(compatSubcategoryFields(["jewellery", "fashion"], ["ethnic", "Temple pieces"])).toEqual({
      subcategory: "Temple pieces",
      productsServices: "sub:Ethnic wear",
    });
    expect(compatSubcategoryFields(["jewellery", "fashion"], ["ethnic"])).toEqual({
      subcategory: "Ethnic wear",
      productsServices: null,
    });
    expect(compatSubcategoryFields([], [])).toEqual({ subcategory: null, productsServices: null });
  });

  it("keeps free-text products/services, name and city when facts leave them null", () => {
    const base = emptyStartDraft();
    base.business.name = "Kept";
    base.business.city = "Pune";
    base.business.productsServices = "Hand-made soaps";
    const d = applyStoreFacts(base, { name: null, categories: ["beauty"], subcategories: [], city: null });
    expect(d.business.name).toBe("Kept");
    expect(d.business.city).toBe("Pune");
    expect(d.business.productsServices).toBe("Hand-made soaps");
  });

  it("round-trips via storeFactsFromDraft and reports completeness", () => {
    const d = applyStoreFacts(emptyStartDraft(), facts);
    const back = storeFactsFromDraft(d);
    expect(applyStoreFacts(emptyStartDraft(), back)).toEqual(d);
    expect(storeFactsComplete(back)).toBe(true);
    expect(storeFactsComplete({ ...back, subcategories: [] })).toBe(false);
  });
});

describe("multi-category draft parsing", () => {
  it("parses drafts saved before multi-select and falls back to single fields + sub: extras", () => {
    const old = JSON.parse(JSON.stringify(emptyStartDraft())) as Loose;
    delete old.business.categories;
    delete old.business.subcategories;
    delete old.voice.facts.categories;
    delete old.voice.facts.subcategories;
    old.business.name = "Old Store";
    old.business.category = "jewellery";
    old.business.subcategory = "gold";
    old.business.productsServices = "sub:silver,Temple pieces";
    const d = parseStartDraft(old);
    expect(d).not.toBeNull();
    expect(d!.business.categories).toEqual([]);
    expect(draftCategories(d!)).toEqual(["jewellery"]);
    expect(draftSubcategories(d!)).toEqual(["gold", "silver", "Temple pieces"]);
    expect(businessComplete(d!)).toBe(true);
  });

  it("parses a draft on the new build screen and prefers voice lists when business lists are empty", () => {
    const d = emptyStartDraft();
    d.screen = "build";
    d.voice.facts.categories = ["fashion", "beauty"];
    d.voice.facts.subcategories = ["ethnic"];
    const parsed = parseStartDraft(JSON.parse(JSON.stringify(d)))!;
    expect(parsed.screen).toBe("build");
    expect(draftCategories(parsed)).toEqual(["fashion", "beauty"]);
    expect(draftSubcategories(parsed)).toEqual(["ethnic"]);
  });

  it("migrates v1 legacy business screen to the quiz", () => {
    const v1 = JSON.parse(JSON.stringify(emptyStartDraft())) as Loose;
    v1.v = 1;
    v1.screen = "products";
    expect(parseStartDraft(v1)?.screen).toBe("quiz");
  });
});
