import { describe, expect, it } from "vitest";
import { buildSeedBrief } from "@/features/start/brief";
import { emptyStartDraft } from "@/features/start/draft/schema";
import { applyStoreFacts } from "@/features/start/draft/apply-facts";

describe("buildSeedBrief", () => {
  it("includes product title, mood, subcategory, and products/services", () => {
    const d = emptyStartDraft();
    d.business.name = "Meera Handloom";
    d.business.category = "fashion";
    d.business.subcategory = "ethnic";
    d.business.productsServices = "Bandhani stoles and sarees";
    d.mood = "kamal";
    d.accent = "#EC4899";
    d.products = [{ id: "1", title: "Bandhani stole", pricePaise: 145_000 }];
    const brief = buildSeedBrief(d);
    expect(brief).toContain("Meera Handloom");
    expect(brief).toContain("Bandhani stole");
    expect(brief).toContain("kamal");
    expect(brief).toContain("#EC4899");
    expect(brief).toContain("Product types: Ethnic wear, Bandhani stoles and sarees");
    expect(brief).toContain("Products / services: Bandhani stoles and sarees");
  });

  it("lists every category and every product-type label for multi-select drafts", () => {
    const d = applyStoreFacts(emptyStartDraft(), {
      name: "Noida Gems",
      categories: ["jewellery", "fashion"],
      subcategories: ["imitation", "bridal", "ethnic", "Temple pieces"],
      city: "Noida",
    });
    const brief = buildSeedBrief(d);
    expect(brief).toContain("Industry/category: jewellery");
    expect(brief).toContain("Categories: jewellery, fashion");
    expect(brief).toContain("Product types: Fashion jewellery, Bridal sets, Ethnic wear, Temple pieces");
    expect(brief).toContain("Site mode: ecommerce");
  });
});
