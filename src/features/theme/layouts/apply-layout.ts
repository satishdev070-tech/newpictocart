import type { HomeItem, ThemePreset } from "../marketplace/types";
import { personalityFor, type LayoutPersonality } from "./personalities";

/**
 * Gives a marketplace preset its layout: section variants, header style and footer layout from
 * the industry's personality, chosen by the theme's position (`index`) within its industry.
 * Values a preset sets itself are never overridden. PURE; returns a new preset.
 *
 * How a theme declares its layout (the "variant API"):
 *  - per section, in its `home` / `collection` / `product` items: `["Hero", { variant: "split" }]`,
 *    `["ProductGrid", { variant: "masonry" }]`, `["TrustBadges", { layout: "badges" }]`, ...
 *    (keys and values: ../sections/variants.ts);
 *  - for the chrome: `preset.headerStyle` and `preset.footerLayout`;
 *  - anything left unset is filled here from the personality.
 */

const at = <T>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length]!;

/** Which personality list feeds which section setting. */
const FILL: Partial<Record<string, { key: string; from: (p: LayoutPersonality) => readonly string[] }[]>> = {
  Hero: [
    { key: "variant", from: (p) => p.hero },
    { key: "panelTone", from: (p) => p.heroPanel },
  ],
  ProductGrid: [
    { key: "variant", from: (p) => p.products },
    { key: "spacing", from: (p) => p.spacing },
  ],
  CategoryGrid: [{ key: "variant", from: (p) => p.categories }],
  CollectionGrid: [{ key: "layout", from: (p) => p.collections }],
  BrandStory: [{ key: "variant", from: (p) => p.story }],
  EditorialImageText: [{ key: "variant", from: (p) => p.editorial }],
  Testimonials: [{ key: "variant", from: (p) => p.testimonials }],
  Newsletter: [{ key: "variant", from: (p) => p.newsletter }],
  TrustBadges: [{ key: "layout", from: (p) => p.usp }],
};

/** Settings that only make sense with the classic full-bleed hero. */
const isClassicHero = (style: Record<string, unknown>) => style.height === "banner" || style.counter === true;
/** Dense, many-column grids (marketplace stores) stay grids. */
const isDenseGrid = (style: Record<string, unknown>) => typeof style.columns === "number" && style.columns >= 5;

function fillItems(items: readonly HomeItem[], p: LayoutPersonality, index: number): HomeItem[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const [type, style, slot] = item;
    const rules = FILL[type];
    if (!rules) return item;
    const n = seen.get(type) ?? 0;
    seen.set(type, n + 1);
    const next = { ...style };
    for (const { key, from } of rules) {
      if (key in next) continue;
      if (type === "Hero" && key === "variant" && isClassicHero(next)) continue;
      if (type === "ProductGrid" && key === "variant" && isDenseGrid(next)) continue;
      // The n-th section of a type steps through the list too, so two grids on one page differ.
      next[key] = at(from(p), index + n);
    }
    return slot === undefined ? [type, next] : [type, next, slot];
  });
}

export function withLayout(preset: ThemePreset, industry: string, index: number): ThemePreset {
  const p = personalityFor(industry);
  return {
    ...preset,
    family: preset.family ?? p.family,
    headerStyle: preset.headerStyle ?? at(p.header, index),
    footerLayout: preset.footerLayout ?? at(p.footer, index),
    home: fillItems(preset.home, p, index),
    ...(preset.collection ? { collection: fillItems(preset.collection, p, index) } : {}),
    ...(preset.product ? { product: fillItems(preset.product, p, index) } : {}),
  };
}

/** The layout a preset ended up with, for mockups, marketplace filters and the AI builder. */
export function layoutSummary(preset: ThemePreset): { hero: string; products: string; headerStyle: string; footerLayout: string } {
  const style = (type: string, key: string, fallback: string) => {
    const hit = preset.home.find(([t]) => t === type);
    const value = hit?.[1][key];
    return typeof value === "string" ? value : fallback;
  };
  return {
    hero: style("Hero", "variant", "overlay"),
    products: preset.home.some(([t]) => t === "ProductGrid") ? style("ProductGrid", "variant", "grid") : "rail",
    headerStyle: preset.headerStyle ?? "classic",
    footerLayout: preset.footerLayout ?? "columns",
  };
}
