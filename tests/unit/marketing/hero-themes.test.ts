import { describe, expect, it } from "vitest";
import { heroIndustryFor, heroThemesForWords } from "@/features/marketing-site/hero-themes";
import { ecommerceMarketplaceThemes } from "@/features/theme/marketplace/catalog";
import { DEFAULT_LANDING } from "@/features/marketing-site/landing";
import { hasThemeShots, themeShotSrcSet } from "@/features/marketing-site/theme-shots";

const themes = ecommerceMarketplaceThemes();

describe("heroIndustryFor", () => {
  it("maps headline words to the business they name", () => {
    expect(heroIndustryFor("Home Bakers")).toBe("gourmet");
    expect(heroIndustryFor("Boutiques")).toBe("fashion");
    expect(heroIndustryFor("Fashion Brands")).toBe("fashion");
    expect(heroIndustryFor("Jewellery Store")).toBe("jewellery");
    expect(heroIndustryFor("Jewellers")).toBe("jewellery");
    expect(heroIndustryFor("Artisans")).toBe("handicrafts");
    expect(heroIndustryFor("Gift Shops")).toBe("gifts");
    expect(heroIndustryFor("Dreamers")).toBeNull();
  });
});

describe("heroThemesForWords", () => {
  it("pairs each word with a theme of its industry, never repeating one", () => {
    const words = ["Home Bakers", "Boutiques", "Fashion Brands", "Jewellery Store", "Artisans", "Gift Shops"];
    const picked = heroThemesForWords(words, themes);
    expect(picked.map((t) => t?.industry)).toEqual(["gourmet", "fashion", "fashion", "jewellery", "handicrafts", "gifts"]);
    expect(new Set(picked.map((t) => t?.key)).size).toBe(words.length);
  });

  it("falls back to the next unused fallback theme for unknown words", () => {
    const fallback = themes.filter((t) => t.industry === "watches");
    const [t] = heroThemesForWords(["Dreamers"], themes, fallback);
    expect(t?.key).toBe(fallback[0]!.key);
  });

  it("returns null when nothing usable is left", () => {
    expect(heroThemesForWords(["Home Bakers"], themes, [], () => false)).toEqual([null]);
  });

  it("has desktop and phone screenshots for every default hero word", () => {
    const picked = heroThemesForWords(DEFAULT_LANDING.hero.rotatingWords, themes, [], (t) => hasThemeShots(t.key));
    for (const t of picked) {
      expect(t).not.toBeNull();
      expect(themeShotSrcSet(t!.key)).toContain("-desktop-640.webp 640w");
    }
  });
});
