import { describe, expect, it } from "vitest";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";
import {
  DEFAULT_PRODUCT_TYPES,
  GENERIC_TEMPLATE,
  INDUSTRY_PRODUCT_TYPES,
  LEGACY_PRODUCT_TYPES,
  PRODUCT_TYPE_KEY_RE,
  defaultTypeForIndustry,
  effectiveProductType,
  extraSpecs,
  groupTypesForPicker,
  isTypeCheckViolation,
  mergeCatalogue,
  productTypeKeySchema,
  setSpecValue,
  specValue,
  templateFor,
  typeKeyFromLabel,
  typeLabel,
  withTypeFallback,
} from "@/features/catalog/product-types";
import { mainImage, moveBy, moveToFront, sortByPosition } from "@/features/catalog/media-order";
import { dbToDraft, type DbProduct } from "@/features/catalog/draft";
import { readAttributes } from "@/features/storefront/server/catalog";

describe("default product-type catalogue", () => {
  it("has unique, well-formed keys and keeps every legacy key", () => {
    const keys = DEFAULT_PRODUCT_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(PRODUCT_TYPE_KEY_RE);
    for (const k of LEGACY_PRODUCT_TYPES) expect(keys).toContain(k);
  });

  it("suggests at least three types for every industry", () => {
    for (const slug of INDUSTRY_SLUGS) {
      expect(INDUSTRY_PRODUCT_TYPES[slug].length, slug).toBeGreaterThanOrEqual(3);
      expect(INDUSTRY_PRODUCT_TYPES[slug]).not.toContain("other");
    }
  });

  it("only references real industries", () => {
    for (const t of DEFAULT_PRODUCT_TYPES) for (const i of t.industries) expect(INDUSTRY_SLUGS as string[]).toContain(i);
  });

  it("maps industries to relevant types", () => {
    expect(INDUSTRY_PRODUCT_TYPES.fashion).toEqual(expect.arrayContaining(["kurta", "saree", "dress"]));
    expect(INDUSTRY_PRODUCT_TYPES.electronics).toEqual(expect.arrayContaining(["smartphone", "laptop"]));
    expect(INDUSTRY_PRODUCT_TYPES.grocery).toContain("staples");
    expect(INDUSTRY_PRODUCT_TYPES.books).toContain("book");
    expect(INDUSTRY_PRODUCT_TYPES.electronics).not.toContain("kurta");
  });

  it("picks the first industry suggestion for new products, else other", () => {
    expect(defaultTypeForIndustry("fashion")).toBe("kurta");
    expect(defaultTypeForIndustry("electronics")).toBe("smartphone");
    expect(defaultTypeForIndustry(null)).toBe("other");
    expect(defaultTypeForIndustry("not-an-industry")).toBe("other");
  });
});

describe("attribute templates", () => {
  it("shows clothing fields and sizes only for apparel", () => {
    expect(templateFor("kurta")).toMatchObject({ fashion: true, sizes: true });
    expect(templateFor("smartphone")).toMatchObject({ fashion: false, sizes: false });
    expect(templateFor("smartphone").specs).toContain("Warranty");
    expect(templateFor("staples").specs).toEqual(expect.arrayContaining(["Net weight", "Ingredients", "Shelf life"]));
    expect(templateFor("shoes")).toMatchObject({ fashion: false, sizes: true });
  });

  it("falls back to the generic template for unknown keys", () => {
    expect(templateFor("handmade_soap")).toEqual(GENERIC_TEMPLATE);
    expect(typeLabel("handmade_soap")).toBe("Handmade soap");
    expect(typeLabel("kurta_set")).toBe("Kurta set");
  });

  it("stores template fields as spec rows (set, update, clear)", () => {
    let specs = setSpecValue([], "Warranty", "1 year");
    expect(specs).toEqual([{ label: "Warranty", value: "1 year" }]);
    specs = setSpecValue([...specs, { label: "Colour", value: "Blue" }], "warranty", "2 years");
    expect(specValue(specs, "Warranty")).toBe("2 years");
    expect(specs[0]!.label).toBe("Warranty");
    specs = setSpecValue(specs, "Warranty", "  ");
    expect(specs).toEqual([{ label: "Colour", value: "Blue" }]);
  });

  it("separates free-form specs from template fields", () => {
    const specs = [
      { label: "Warranty", value: "1 year" },
      { label: "Battery life", value: "10 h" },
    ];
    expect(extraSpecs(specs, templateFor("smartphone").specs)).toEqual([{ spec: specs[1], index: 1 }]);
  });
});

describe("catalogue merging and picker groups", () => {
  it("lets platform rows rename/disable defaults and add types; store rows never shadow", () => {
    const merged = mergeCatalogue(
      [
        { key: "kurta", label: "Kurti", plural_label: null, industries: ["fashion"], template: {}, position: 1, status: "active" },
        { key: "saree", label: "Saree", plural_label: null, industries: ["fashion"], template: {}, position: 2, status: "disabled" },
        { key: "drone", label: "Drone", plural_label: "Drones", industries: ["electronics"], template: { specs: ["Flight time"] }, position: 3, status: "active" },
      ],
      [
        { key: "kurta", label: "Mine", template: {} },
        { key: "handmade_soap", label: "Handmade soap", template: {} },
      ],
    );
    expect(typeLabel("kurta", merged)).toBe("Kurti");
    expect(templateFor("kurta", merged).fashion).toBe(true); // {} keeps the default template
    expect(merged.find((t) => t.key === "saree")!.status).toBe("disabled");
    expect(templateFor("drone", merged).specs).toEqual(["Flight time"]);
    expect(merged.find((t) => t.key === "handmade_soap")!.source).toBe("store");
    expect(merged.filter((t) => t.key === "kurta")).toHaveLength(1);

    const g = groupTypesForPicker(merged, "fashion");
    expect(g.suggested.map((t) => t.key)).toContain("kurta");
    expect(g.suggested.map((t) => t.key)).not.toContain("saree");
    expect(g.store.map((t) => t.key)).toEqual(["handmade_soap"]);
    expect(g.others.at(-1)!.key).toBe("other");
    // The current value stays selectable even when disabled or unknown.
    expect(groupTypesForPicker(merged, "fashion", "saree").suggested.map((t) => t.key)).toContain("saree");
    expect(groupTypesForPicker(merged, null, "legacy_thing").others[0]!.key).toBe("legacy_thing");
  });

  it("builds keys from labels", () => {
    expect(typeKeyFromLabel("Handmade Soap")).toBe("handmade_soap");
    expect(typeKeyFromLabel("Bath & Body")).toBe("bath_and_body");
    expect(typeKeyFromLabel("Décor!!")).toBe("decor");
    expect(typeKeyFromLabel("!!!")).toBe("");
    expect(productTypeKeySchema.parse(" Kurta ")).toBe("kurta");
    expect(productTypeKeySchema.safeParse("bad key").success).toBe(false);
  });
});

describe("pre-migration product-type fallback", () => {
  it("only applies to new keys rejected by the old CHECK", () => {
    const err = { code: "23514", message: 'new row for relation "products" violates check constraint "products_product_type_check"' };
    expect(isTypeCheckViolation(err, "smartphone")).toBe(true);
    expect(isTypeCheckViolation(err, "kurta")).toBe(false);
    expect(isTypeCheckViolation({ code: "23514", message: "compare_at_price" }, "smartphone")).toBe(false);
    expect(isTypeCheckViolation(null, "smartphone")).toBe(false);
  });

  it("round-trips the key through attributes._type", () => {
    const payload = withTypeFallback({ id: null, product: { product_type: "smartphone", attributes: { specs: [] } as Record<string, unknown> } });
    expect(payload.product.product_type).toBe("other");
    expect(payload.product.attributes._type).toBe("smartphone");
    expect(effectiveProductType(payload.product.product_type, payload.product.attributes)).toBe("smartphone");
    expect(effectiveProductType("kurta", { _type: "smartphone" })).toBe("kurta");
    expect(effectiveProductType("other", {})).toBe("other");
    expect(readAttributes({ _type: "smartphone", fabric: "Cotton" })).toEqual([{ label: "Fabric", value: "Cotton" }]);
  });

  it("keeps old and new type values when loading a product into the editor", () => {
    const base: DbProduct = {
      id: "p1",
      updated_at: "2026-01-01",
      title: "T",
      slug: "t",
      description: null,
      short_description: null,
      product_type: "kurta",
      brand: null,
      category_id: null,
      size_chart_id: null,
      status: "draft",
      featured: false,
      tags: [],
      attributes: {},
      care_instructions: null,
      shipping_info: null,
      return_info: null,
      hsn_code: null,
      seo: {},
    };
    expect(dbToDraft(base, [], [], []).productType).toBe("kurta");
    expect(dbToDraft({ ...base, product_type: "smartphone" }, [], [], []).productType).toBe("smartphone");
    expect(dbToDraft({ ...base, product_type: "other", attributes: { _type: "laptop" } }, [], [], []).productType).toBe("laptop");
  });
});

describe("main image ordering", () => {
  const media = [
    { id: "b", position: 1, storage_path: "tenant/x/b.jpg" },
    { id: "a", position: 0, storage_path: "tenant/x/a.jpg" },
    { id: "c", position: 1, storage_path: "tenant/x/a2.jpg" },
  ];

  it("sorts by position with a stable tie-break and picks the main image", () => {
    expect(sortByPosition(media).map((m) => m.id)).toEqual(["a", "c", "b"]);
    expect(mainImage(media)!.id).toBe("a");
    expect(mainImage([])).toBeUndefined();
  });

  it("moves an image to the front to make it main", () => {
    expect(moveToFront(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(moveToFront(["a", "b", "c"], "a")).toEqual(["a", "b", "c"]);
    expect(moveToFront(["a", "b"], "zz")).toEqual(["a", "b"]);
  });

  it("swaps neighbours and ignores moves past the ends", () => {
    expect(moveBy(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveBy(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveBy(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveBy(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
