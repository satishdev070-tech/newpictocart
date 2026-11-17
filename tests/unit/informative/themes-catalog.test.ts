import { describe, expect, it } from "vitest";
import { INFO_CATEGORY_IDS } from "@/features/informative/categories";
import { THEME_DEMO_SERVICE_TYPE } from "@/features/informative/demo";
import { INFO_PHOTOS_PER_SITE, infoPhotoSet, photoPoolKey } from "@/features/informative/images/catalog";
import { findServiceType } from "@/features/informative/service-types";
import { contrastRatio } from "@/features/informative/themes/color";
import { FONT_PAIRS } from "@/features/informative/themes/fonts";
import { INFORMATIVE_THEMES, findInformativeTheme, recommendedThemeIds } from "@/features/informative/themes/registry";
import { themeConfigSchema } from "@/features/informative/themes/types";

/**
 * Theme catalogue (21 themes): every config is valid data with its OWN palette passing WCAG AA
 * before any derivation (tokens.ts can rescue a weak colour, but a theme should not rely on it),
 * a real font pair, and a demo backed by enough curated photos.
 */
describe("theme catalogue", () => {
  it("21 themes, all parse with the schema, ids kebab-case and unique", () => {
    expect(INFORMATIVE_THEMES).toHaveLength(21);
    const ids = INFORMATIVE_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of INFORMATIVE_THEMES) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const r = themeConfigSchema.safeParse(t);
      expect(r.success, `${t.id}: ${r.success ? "" : r.error.message}`).toBe(true);
      expect(findInformativeTheme(t.id)).toBe(t);
    }
  });

  it("raw palette: text and muted text reach 4.5:1 on background and surface", () => {
    for (const t of INFORMATIVE_THEMES) {
      const c = t.tokens.colors;
      const pairs: [string, string, string][] = [
        ["text/background", c.text, c.background],
        ["text/surface", c.text, c.surface],
        ["mutedText/background", c.mutedText, c.background],
        ["mutedText/surface", c.mutedText, c.surface],
      ];
      for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), `${t.id} ${name}`).toBeGreaterThanOrEqual(4.5);
      // Dark flag matches the background, so chrome (borders, overlays) picks the right side.
      expect(contrastRatio(c.background, "#000000") < contrastRatio(c.background, "#FFFFFF"), t.id).toBe(t.tokens.dark);
    }
  });

  it("every theme uses a font pair the Appearance picker offers", () => {
    for (const t of INFORMATIVE_THEMES) {
      expect(FONT_PAIRS.some((p) => p.heading === t.tokens.fonts.heading && p.body === t.tokens.fonts.body), t.id).toBe(true);
    }
  });

  it("palettes are distinct: no two themes share primary + background", () => {
    const keys = INFORMATIVE_THEMES.map((t) => `${t.tokens.colors.primary}/${t.tokens.colors.background}`.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("recommends 1–2 valid themes for every category", () => {
    for (const c of INFO_CATEGORY_IDS) {
      const ids = recommendedThemeIds(c);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(2);
      for (const id of ids) expect(findInformativeTheme(id), `${c} → ${id}`).not.toBeNull();
    }
  });

  it("every theme's demo uses a curated service type from its demo category, with ≥ 7 unique photos", () => {
    for (const t of INFORMATIVE_THEMES) {
      const typeId = THEME_DEMO_SERVICE_TYPE[t.id];
      expect(typeId, t.id).toBeDefined();
      expect(findServiceType(typeId)?.family, `${t.id} → ${typeId}`).toBe(t.demoCategory);
      expect(photoPoolKey(typeId), `${t.id} → ${typeId}`).not.toBeNull();
      const set = infoPhotoSet(t.demoCategory, typeId);
      expect(set.length, t.id).toBeGreaterThanOrEqual(INFO_PHOTOS_PER_SITE);
      expect(new Set(set.map((p) => p.id)).size).toBe(set.length);
      for (const p of set) expect(p.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    }
    expect(Object.keys(THEME_DEMO_SERVICE_TYPE).sort()).toEqual(INFORMATIVE_THEMES.map((t) => t.id).sort());
  });

  it("every theme ships a picker thumbnail", async () => {
    const { existsSync } = await import("node:fs");
    for (const t of INFORMATIVE_THEMES) expect(existsSync(`public/informative/themes/${t.id}.webp`), t.id).toBe(true);
  });
});
