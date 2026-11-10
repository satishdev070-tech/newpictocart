import { describe, expect, it } from "vitest";
import { INDUSTRY_SLUGS, type IndustrySlug } from "@/features/stores/industries";
import {
  isSubcategory,
  subcategoriesFor,
  subcategoryLabel,
} from "@/features/stores/subcategories";

describe("store subcategories", () => {
  it("maps every industry to 4–8 subcategories", () => {
    for (const slug of INDUSTRY_SLUGS) {
      const list = subcategoriesFor(slug);
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(8);
      const slugs = list.map((s) => s.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const entry of list) {
        expect(entry.slug.length).toBeGreaterThan(0);
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("validates and labels fashion ethnic/western", () => {
    const industry: IndustrySlug = "fashion";
    expect(isSubcategory(industry, "ethnic")).toBe(true);
    expect(isSubcategory(industry, "western")).toBe(true);
    expect(isSubcategory(industry, "nope")).toBe(false);
    expect(subcategoryLabel(industry, "ethnic")).toBe("Ethnic wear");
    expect(subcategoryLabel(industry, "missing")).toBeNull();
  });

  it("covers grocery snacks and beauty skincare", () => {
    expect(isSubcategory("grocery", "snacks")).toBe(true);
    expect(isSubcategory("sweets", "namkeen")).toBe(true);
    expect(isSubcategory("beauty", "skincare")).toBe(true);
  });
});
