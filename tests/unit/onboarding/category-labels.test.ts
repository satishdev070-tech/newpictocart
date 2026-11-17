import { describe, expect, it } from "vitest";
import { categoryLabel } from "@/features/onboarding/voice/category-labels";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";

const LOCALES = ["hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"];

describe("categoryLabel", () => {
  it("returns English for en-IN and unknown locales / slugs", () => {
    expect(categoryLabel("jewellery", "en-IN")).toBe("Jewellery & Accessories");
    expect(categoryLabel("jewellery", "ur-IN")).toBe("Jewellery & Accessories");
    expect(categoryLabel("Handmade anklets", "hi-IN")).toBe("Handmade anklets");
  });

  it("has a native-script label for every industry in every onboarding language", () => {
    for (const locale of LOCALES) {
      for (const slug of INDUSTRY_SLUGS) {
        const label = categoryLabel(slug, locale);
        expect(label.trim().length, `${locale}:${slug}`).toBeGreaterThan(1);
        expect(label, `${locale}:${slug}`).toMatch(/[^\x00-\x7F]/);
      }
    }
    expect(categoryLabel("jewellery", "hi-IN")).toBe("ज्वेलरी और एक्सेसरीज़");
  });
});
