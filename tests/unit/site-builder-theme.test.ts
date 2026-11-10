import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { parseThemeConfigStrict, type ThemeConfig } from "@/features/theme/schema/config";
import { tokensSchema } from "@/features/theme/schema/tokens";
import { typographySchema, type Typography } from "@/features/theme/schema/site";
import { HEX_COLOR_RE } from "@/features/theme/schema/primitives";
import { typographyCss } from "@/features/theme/tokens-style";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import {
  applyPalette,
  applyPresetTokens,
  COLOR_KEYS,
  colourSearchHaystack,
  filterPalettes,
  filterThemesByColourSearch,
  isPaletteActive,
  matchesColourSearch,
  PALETTES,
} from "@/features/theme/site-builder/palettes";

const base = (): ThemeConfig => structuredClone(DEFAULT_THEME_CONFIG);
const typo = (patch: Partial<Record<keyof Typography, Record<string, unknown>>>): Typography => typographySchema.parse(patch) as Typography;

describe("site builder palettes", () => {
  it("ships 8–10 palettes with unique keys and valid hex colours for all 7 tokens", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(8);
    expect(PALETTES.length).toBeLessThanOrEqual(10);
    expect(new Set(PALETTES.map((p) => p.key)).size).toBe(PALETTES.length);
    for (const p of PALETTES) {
      expect(Object.keys(p.colors).sort()).toEqual([...COLOR_KEYS].sort());
      for (const k of COLOR_KEYS) expect(p.colors[k]).toMatch(HEX_COLOR_RE);
      const parsed = tokensSchema.safeParse({ colors: p.colors });
      expect(parsed.success).toBe(true);
    }
  });

  it("applyPalette replaces only the colours and ignores invalid values", () => {
    const c = base();
    const p = PALETTES[1]!;
    const next = applyPalette(c, p.colors);
    expect(isPaletteActive(next.tokens, p)).toBe(true);
    expect(next.templates).toBe(c.templates);
    expect({ ...next.tokens, colors: c.tokens.colors }).toEqual(c.tokens);

    const bad = applyPalette(c, { primary: "red", text: "#ABCDEF" });
    expect(bad.tokens.colors.primary).toBe(c.tokens.colors.primary);
    expect(bad.tokens.colors.text).toBe("#abcdef");
    expect(parseThemeConfigStrict(next).ok).toBe(true);
  });

  it("filters palettes by hex, colour role name, or palette name", () => {
    expect(filterPalettes(PALETTES, "")).toHaveLength(PALETTES.length);
    expect(filterPalettes(PALETTES, "ocean").map((p) => p.key)).toEqual(["ocean"]);
    expect(filterPalettes(PALETTES, "#0b3c5d").some((p) => p.key === "ocean")).toBe(true);
    expect(filterPalettes(PALETTES, "0b3c5d").some((p) => p.key === "ocean")).toBe(true);
    expect(filterPalettes(PALETTES, "sale").length).toBeGreaterThan(0);
    expect(filterPalettes(PALETTES, "zzznomatch")).toEqual([]);
    const hay = colourSearchHaystack({ name: "Ocean", colors: PALETTES.find((p) => p.key === "ocean")!.colors });
    expect(matchesColourSearch("primary", hay)).toBe(true);
    expect(matchesColourSearch("#d9b310", hay)).toBe(true);
  });

  it("filters marketplace themes by name and colour hex", () => {
    const sample = [
      { name: "Coastal", tagline: "Sea breeze", industry: "fashion", style: "airy", preset: { tokens: { colors: { primary: "#0b3c5d", accent: "#d9b310" } } } },
      { name: "Ink", tagline: "Dark type", industry: "books", style: "editorial", preset: { tokens: { colors: { primary: "#111111", accent: "#c9a24a" } } } },
    ] as const;
    expect(filterThemesByColourSearch(sample, "coastal")).toHaveLength(1);
    expect(filterThemesByColourSearch(sample, "#0b3c5d")).toHaveLength(1);
    expect(filterThemesByColourSearch(sample, "books")).toHaveLength(1);
    expect(filterThemesByColourSearch(sample, "")).toHaveLength(2);
  });
});

describe("typographyCss", () => {
  it("emits nothing for defaults", () => {
    expect(typographyCss(undefined)).toBe("");
    expect(typographyCss(typo({}))).toBe("");
  });

  it("emits desktop sizes and clamped 80% mobile sizes", () => {
    const css = typographyCss(typo({ h1: { size: 60, weight: "700" }, small: { size: 13 }, p: { lineHeight: 150, font: "heading" } }));
    expect(css).toContain("[data-sf-root] h1{font-size:60px;font-weight:700}");
    expect(css).toContain("[data-sf-root] p{font-family:var(--sf-font-heading);line-height:1.50}");
    expect(css).toContain("@media (max-width:767px){");
    expect(css).toContain("[data-sf-root] h1{font-size:48px}");
    // 13 * 0.8 = 10.4 -> clamped to 12px
    expect(css).toContain("[data-sf-root] small,[data-sf-root] .text-xs,[data-sf-root] .text-sm{font-size:12px}");
    // line height alone gives no mobile rule for p
    expect(css.split("@media")[1]).not.toContain(" p{");
  });

  it("ignores bad values", () => {
    const raw = { h1: { size: 12.5, weight: "bold; color:red", font: "evil", lineHeight: -3 }, h2: { size: -10, weight: "900", font: "default", lineHeight: 0 } } as unknown as Typography;
    expect(typographyCss(raw)).toBe("");
  });
});

describe("applyPresetTokens", () => {
  const theme = MARKETPLACE_THEMES.find((t) => t.preset.tokens.headingFont !== DEFAULT_THEME_CONFIG.tokens.headingFont) ?? MARKETPLACE_THEMES[0]!;

  it("changes only design tokens, never content", () => {
    const c = base();
    c.tokens.typography.h1.size = 52;
    c.tokens.imagery = "off";
    const next = applyPresetTokens(c, theme.preset.tokens);
    for (const k of ["header", "productCard", "layout", "templates", "pages", "popups", "menus", "embeds", "schemaVersion"] as const) expect(next[k]).toBe(c[k]);
    expect(next.tokens.headingFont).toBe(theme.preset.tokens.headingFont);
    expect(next.tokens.bodyFont).toBe(theme.preset.tokens.bodyFont);
    for (const k of COLOR_KEYS) expect(next.tokens.colors[k]).toBe(theme.preset.tokens.colors[k]!.toLowerCase());
    // seller's per-level type scale and stock-photo choice are kept
    expect(next.tokens.typography.h1.size).toBe(52);
    expect(next.tokens.imagery).toBe("off");
    expect(c.tokens.headingFont).toBe(DEFAULT_THEME_CONFIG.tokens.headingFont);
    expect(parseThemeConfigStrict(next).ok).toBe(true);
  });

  it("produces valid tokens for every marketplace theme", () => {
    for (const t of MARKETPLACE_THEMES) {
      const next = applyPresetTokens(base(), t.preset.tokens);
      expect(tokensSchema.safeParse(next.tokens).success).toBe(true);
    }
  });

  it("keeps current values for invalid or unknown preset values", () => {
    const c = base();
    const next = applyPresetTokens(c, { headingFont: "comic-sans", buttonShape: "pill", colors: { primary: "nope" }, typography: { h1: { size: 99 } }, imagery: "food" });
    expect(next.tokens.headingFont).toBe(c.tokens.headingFont);
    expect(next.tokens.buttonShape).toBe("pill");
    expect(next.tokens.colors.primary).toBe(c.tokens.colors.primary);
    expect(next.tokens.typography).toEqual(c.tokens.typography);
    expect(next.tokens.imagery).toBe(c.tokens.imagery);
    expect(applyPresetTokens(c, null)).toBe(c);
  });
});
