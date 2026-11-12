import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INFO_CATEGORY_IDS } from "@/features/informative/categories";
import { contrastRatio } from "@/features/informative/themes/color";
import { FONT_PAIRS, FONT_KEYS } from "@/features/informative/themes/fonts";
import { FALLBACK_THEME_IDS, INFORMATIVE_THEMES, findInformativeTheme, recommendedThemeIds, themeOrDefault } from "@/features/informative/themes/registry";
import { resolveColors, themeCssVars } from "@/features/informative/themes/tokens";
import { themeConfigSchema } from "@/features/informative/themes/types";

const PLAN_IDS = ["nexus-core", "aura-one", "zenith-prime", "prism-deck", "ascent-peak", "vibe-shift", "neon-slate", "style-capital", "pure-gold", "radiant-alpha", "smooth-wave"];

describe("theme registry", () => {
  it("has exactly the plan's 11 themes, in order, each in its own folder", () => {
    expect(INFORMATIVE_THEMES.map((t) => t.id)).toEqual(PLAN_IDS);
    const folders = readdirSync("src/features/informative/themes", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(folders).toEqual([...PLAN_IDS].sort());
  });

  it("every config passes the schema", () => {
    for (const t of INFORMATIVE_THEMES) {
      const r = themeConfigSchema.safeParse(t);
      expect(r.success, `${t.id}: ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });

  it("every recommended category and demo category is a real onboarding category", () => {
    for (const t of INFORMATIVE_THEMES) {
      for (const c of t.recommendedCategories) expect(INFO_CATEGORY_IDS).toContain(c);
      expect(t.recommendedCategories).toContain(t.demoCategory);
    }
  });

  it("recommends 1–2 existing themes for every category, with the plan's fallback", () => {
    for (const c of INFO_CATEGORY_IDS) {
      const ids = recommendedThemeIds(c);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(2);
      for (const id of ids) expect(findInformativeTheme(id)).not.toBeNull();
    }
    expect(recommendedThemeIds("other")).toEqual([...FALLBACK_THEME_IDS]);
    expect(recommendedThemeIds("wellness")).toEqual(["nexus-core", "smooth-wave"]);
    expect(recommendedThemeIds(null)).toEqual(["nexus-core", "smooth-wave"]);
    expect(recommendedThemeIds("clinic_healthcare")[0]).toBe("zenith-prime");
    expect(recommendedThemeIds("salon_beauty")[0]).toBe("radiant-alpha");
    expect(recommendedThemeIds("gym_fitness")[0]).toBe("ascent-peak");
    expect(recommendedThemeIds("interior_design")[0]).toBe("vibe-shift");
  });

  it("unknown stored theme ids render the default theme", () => {
    expect(themeOrDefault("removed-theme").id).toBe("nexus-core");
    expect(themeOrDefault("pure-gold").id).toBe("pure-gold");
  });

  it("is a separate registry: the store marketplace catalogue is not imported", () => {
    const src = readFileSync("src/features/informative/themes/registry.ts", "utf8");
    const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.some((i) => i?.includes("features/theme/marketplace"))).toBe(false);
  });
});

describe("WCAG AA for every theme (and seller colour overrides)", () => {
  const OVERRIDES = [{}, { primaryColor: "#FFFF00" }, { primaryColor: "#000000", secondaryColor: "#FFFFFF" }, { primaryColor: "#777777", secondaryColor: "#7F7F7F" }, { primaryColor: "#00FF00" }];
  for (const t of INFORMATIVE_THEMES) {
    it(`${t.id}: text, muted, links and button text reach 4.5:1`, () => {
      for (const o of OVERRIDES) {
        const c = resolveColors(t, o);
        const pairs: [string, string, string][] = [
          ["text/bg", c.text, c.background],
          ["text/surface", c.text, c.surface],
          ["muted/bg", c.muted, c.background],
          ["muted/surface", c.muted, c.surface],
          ["link/bg", c.link, c.background],
          ["link/surface", c.link, c.surface],
          ["onPrimary/primary", c.onPrimary, c.primary],
          ["onSecondary/secondary", c.onSecondary, c.secondary],
        ];
        for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), `${t.id} ${JSON.stringify(o)} ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe("token → CSS variable pipeline", () => {
  it("emits every variable the section library reads", () => {
    const src = readFileSync("src/features/informative/site/sections.tsx", "utf8") + readFileSync("src/features/informative/site/chrome.tsx", "utf8") + readFileSync("src/features/informative/site/ui.tsx", "utf8");
    const used = new Set([...src.matchAll(/--if-[a-z-]+/g)].map((m) => m[0]));
    const vars = themeCssVars(INFORMATIVE_THEMES[0]!);
    for (const v of used) if (!v.startsWith("--if-font-") || v === "--if-font-heading" || v === "--if-font-body") expect(Object.keys(vars), v).toContain(v);
  });

  it("applies seller overrides for colours and font pair", () => {
    const t = INFORMATIVE_THEMES[0]!;
    const vars = themeCssVars(t, { primaryColor: "#AA0000", fontPair: "playfair-lato" });
    expect(vars["--if-primary"]).toBe("#AA0000");
    expect(vars["--if-font-heading"]).toContain("--if-font-playfair");
    expect(vars["--if-font-body"]).toContain("--if-font-lato");
    expect(themeCssVars(t, { fontPair: "nope" })["--if-font-heading"]).toContain("--if-font-inter");
  });

  it("every theme font and font pair is self-hosted by informative-fonts.ts", () => {
    const fonts = readFileSync("src/app/informative-fonts.ts", "utf8");
    for (const k of FONT_KEYS) expect(fonts, k).toContain(`"--if-font-${k}"`);
    for (const p of FONT_PAIRS) expect(INFORMATIVE_THEMES.some((t) => t.tokens.fonts.heading === p.heading && t.tokens.fonts.body === p.body), p.id).toBe(true);
  });
});
