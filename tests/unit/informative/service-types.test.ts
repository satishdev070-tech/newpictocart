import { describe, expect, it } from "vitest";
import { INFO_CATEGORY_IDS } from "@/features/informative/categories";
import { PRICE_TYPES, priceTypeNeedsAmount } from "@/features/informative/pricing";
import { SERVICE_TYPES, fillTemplate, findServiceType, searchServiceTypes, seedFor, serviceTypesByFamily } from "@/features/informative/service-types";
import { MAX_DRAFT_SERVICES } from "@/features/informative/onboarding/draft";

describe("service type catalogue", () => {
  it("has about 50 types with unique ids, each in a valid theme family", () => {
    expect(SERVICE_TYPES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(SERVICE_TYPES.map((s) => s.id)).size).toBe(SERVICE_TYPES.length);
    for (const s of SERVICE_TYPES) {
      expect(s.id).toMatch(/^[a-z0-9_]{2,40}$/);
      expect(INFO_CATEGORY_IDS).toContain(s.family);
      expect(s.label.length).toBeLessThanOrEqual(60);
    }
    // Every family offers at least one type.
    const families = serviceTypesByFamily();
    for (const id of INFO_CATEGORY_IDS) expect(families.get(id)?.length ?? 0).toBeGreaterThan(0);
  });

  it("seed content fits the database limits; prices are integer paise", () => {
    for (const s of SERVICE_TYPES) {
      expect(s.tagline.length).toBeLessThanOrEqual(120);
      expect(s.about.length).toBeLessThanOrEqual(5000);
      expect(s.services.length).toBeGreaterThanOrEqual(4);
      expect(s.services.length).toBeLessThanOrEqual(MAX_DRAFT_SERVICES);
      expect(s.faqs.length).toBeGreaterThanOrEqual(2);
      expect(s.faqs.length).toBeLessThanOrEqual(10);
      for (const v of s.services) {
        expect(PRICE_TYPES).toContain(v.priceType);
        expect(v.name.length).toBeLessThanOrEqual(120);
        expect(v.shortDescription.length).toBeLessThanOrEqual(300);
        if (v.pricePaise !== null) {
          expect(Number.isInteger(v.pricePaise)).toBe(true);
          expect(v.pricePaise).toBeGreaterThanOrEqual(0);
        }
        // The onboarding form demands an amount for fixed / starting-from prices.
        if (priceTypeNeedsAmount(v.priceType)) expect(v.pricePaise).not.toBeNull();
      }
      for (const f of s.faqs) {
        expect(f.question.length).toBeLessThanOrEqual(300);
        expect(f.answer.length).toBeLessThanOrEqual(3000);
      }
    }
  });

  it("fills {name} and {city}, with a natural fallback for a missing city", () => {
    expect(fillTemplate("{name} in {city}", { name: " Smile Care ", city: "Pune" })).toBe("Smile Care in Pune");
    expect(fillTemplate("We serve {city}.", { name: "x", city: "" })).toBe("We serve your area.");
    const seed = seedFor(findServiceType("dentist")!, { name: "Smile Care", city: "Pune" });
    expect(seed.about).toContain("Smile Care is a dental clinic in Pune");
    for (const text of [seed.tagline, seed.about, ...seed.faqs.flatMap((f) => [f.question, f.answer]), ...seed.services.map((s) => s.shortDescription)]) {
      expect(text).not.toMatch(/\{(name|city)\}/);
    }
  });

  it("searches labels and keywords", () => {
    expect(searchServiceTypes("teeth").map((s) => s.id)).toContain("dentist");
    expect(searchServiceTypes("GST").map((s) => s.id)).toContain("chartered_accountant");
    expect(searchServiceTypes("")).toEqual([]);
    expect(findServiceType("nope")).toBeNull();
  });
});
