import { describe, expect, it } from "vitest";
import { DEFAULT_LANDING, parseLanding, THEMES_DEFAULT_COUNT, THEMES_MAX_COUNT, themesShown, validateLanding } from "@/features/marketing-site/landing";
import { pickPreviewDemo, previewDemoCandidates, SHOWCASE_INDUSTRIES, showcaseThemes, themePreviewHref } from "@/features/marketing-site/themes";
import { sampleProducts, sampleStyle } from "@/features/marketing-site/sample-store";
import { INDUSTRY_SHOWCASE, SHOWCASE_STORES } from "@/features/theme/marketplace/showcase";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";

describe("home theme showcase", () => {
  it("shows two rows of four by default, one theme per industry", () => {
    expect(THEMES_DEFAULT_COUNT).toBe(8);
    expect(themesShown(DEFAULT_LANDING.themes)).toBe(8);
    const themes = showcaseThemes(SHOWCASE_INDUSTRIES).slice(0, themesShown(DEFAULT_LANDING.themes));
    expect(themes).toHaveLength(8);
    expect(new Set(themes.map((t) => t.industry)).size).toBe(8);
    expect(themes.map((t) => t.industry)).toEqual(["fashion", "gourmet", "jewellery", "beauty", "furniture", "electronics", "handicrafts", "general"]);
  });

  it("has enough industries for the CMS maximum", () => {
    expect(showcaseThemes(SHOWCASE_INDUSTRIES).length).toBeGreaterThanOrEqual(THEMES_MAX_COUNT);
  });

  it("reads documents saved before `limit` existed (back-compat)", () => {
    const legacy = (count: number) => ({ themes: { enabled: true, badge: "", title: "T", body: "", count, button: DEFAULT_LANDING.themes.button } });
    // The old default (4) becomes the new default; a count the admin changed is kept.
    expect(themesShown(parseLanding(legacy(4)).themes)).toBe(8);
    expect(themesShown(parseLanding(legacy(6)).themes)).toBe(6);
    expect(themesShown(parseLanding({ themes: { ...DEFAULT_LANDING.themes, limit: 4, count: 6 } }).themes)).toBe(4);
    expect(themesShown(parseLanding({ themes: { ...DEFAULT_LANDING.themes, limit: 40 } }).themes)).toBe(8);
    expect(themesShown(parseLanding(null).themes)).toBe(8);
    expect(validateLanding({ ...DEFAULT_LANDING, themes: { ...DEFAULT_LANDING.themes, limit: 12 } }).ok).toBe(true);
    expect(validateLanding({ ...DEFAULT_LANDING, themes: { ...DEFAULT_LANDING.themes, limit: 13 } }).ok).toBe(false);
  });
});

describe("theme preview demo store", () => {
  const theme = { demo: "chinar", industry: "fashion" as const };

  it("prefers the theme's own demo, then its industry store, then the general store", () => {
    const c = previewDemoCandidates(theme);
    expect(c.slice(0, 3)).toEqual(["chinar", INDUSTRY_SHOWCASE.fashion, INDUSTRY_SHOWCASE.general]);
    expect(new Set(c).size).toBe(c.length);
    expect([...c].sort()).toEqual(Object.keys(SHOWCASE_STORES).sort());
  });

  it("picks the first live candidate, or none", () => {
    expect(pickPreviewDemo(theme, new Set(["chinar", "sabkuch"]))).toBe("chinar");
    expect(pickPreviewDemo(theme, new Set(["sabkuch", "kaya-studio"]))).toBe("kaya-studio");
    expect(pickPreviewDemo({ demo: null, industry: "handicrafts" }, new Set(["voltnest"]))).toBe("voltnest");
    expect(pickPreviewDemo(theme, new Set())).toBeNull();
  });

  it("links every theme to its on-site preview page", () => {
    expect(themePreviewHref("minimal-d2c")).toBe("/themes/minimal-d2c/preview");
  });
});

describe("sample store", () => {
  it("has six products with integer paise prices", () => {
    for (const industry of ["fashion", "gourmet", "unknown"]) {
      const p = sampleProducts(industry);
      expect(p).toHaveLength(6);
      for (const x of p) {
        expect(Number.isInteger(x.price)).toBe(true);
        expect(x.price).toBeGreaterThan(0);
        if (x.compareAt !== null) expect(x.compareAt).toBeGreaterThan(x.price);
      }
    }
  });

  it("reads every catalogue preset without throwing", () => {
    for (const t of MARKETPLACE_THEMES) {
      const s = sampleStyle(t.preset);
      expect(s.colors.primary).toMatch(/^#/);
      expect(s.imageRatio).toMatch(/\d/);
    }
  });
});
