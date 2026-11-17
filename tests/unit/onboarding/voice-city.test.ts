import { describe, expect, it } from "vitest";
import { extractCityPhrase, extractFactsFromText } from "@/features/onboarding/voice/facts";

describe("city with Hindi / Hinglish postpositions", () => {
  it.each([
    ["Main kapde bechti hoon Noida mein", "Noida"],
    ["Meri dukaan Noida me hai", "Noida"],
    ["Main Noida se hoon", "Noida"],
    ["Noida mai meri shop hai", "Noida"],
    ["Hum Jaipur ki dukaan hain", "Jaipur"],
    ["in Noida we sell sarees", "Noida"],
    ["I sell sarees in Noida", "Noida"],
    ["मेरी दुकान नोएडा में है", "Noida"],
    ["हम दिल्ली से हैं", "Delhi"],
    ["Main New Delhi se hoon", "New Delhi"],
    ["Main Bareilly se hoon", "Bareilly"],
  ])("%s → %s", (text, city) => {
    expect(extractFactsFromText(text).city).toBe(city);
  });

  it("keeps categories when the city is said with a postposition", () => {
    const out = extractFactsFromText("Noida mein main kapde aur gehne bechti hoon");
    expect(out.city).toBe("Noida");
    expect(out.categories).toEqual(["fashion", "jewellery"]);
  });

  it("does not mistake products, fillers or non-city places for a city", () => {
    expect(extractCityPhrase("Sarees ki dukaan hai")).toBeNull();
    expect(extractCityPhrase("Main ghar se kaam karti hoon")).toBeNull();
    expect(extractCityPhrase("Instagram pe aur Online se bechte hain")).toBeNull();
    expect(extractCityPhrase("main kapde bechti hoon")).toBeNull();
    expect(extractFactsFromText("We sell ethnic wear, skincare aur makeup").city).toBeUndefined();
  });
});
