import {
  STOCK_SLOTS,
  curatedStockSet,
  sizedStockUrl,
  stockIndex,
  type StockImage,
  type StockSet,
  type StockSlot,
} from "@/lib/unsplash-stock";
import { layoutFamily } from "./personalities";
import type { MarketplaceTheme } from "../marketplace/types";

/** Card-sized Unsplash URL shape used by marketing ThemeCard / onboarding thumbs. */
export type ThemeCardImage = {
  url: string;
  alt: string;
  photographer: { name: string; url: string } | null;
  unsplashUrl: string;
  source: "api" | "fallback";
};

/**
 * Stable seed for a marketplace theme's stock rotation. Themes in the same industry/layout family
 * share a photo pool but start at different offsets so marketplace cards, empty slots and
 * onboarding thumbs look distinct. PURE.
 */
export function themeImagerySeed(themeKey: string): number {
  return stockIndex(themeKey);
}

/** Rotate a slot list by a non-negative offset (wraps). PURE. */
export function rotateStockSlot<T>(list: readonly T[], offset: number): T[] {
  if (!list.length) return [];
  const shift = ((offset % list.length) + list.length) % list.length;
  if (shift === 0) return [...list];
  return list.map((_, i) => list[(i + shift) % list.length]!);
}

/**
 * Per-theme view of a category stock set: each slot is rotated by the theme key (plus a small
 * per-slot step) so two themes of the same industry rarely share a hero. PURE.
 */
export function themeStockSet(theme: Pick<MarketplaceTheme, "key" | "industry">, base?: StockSet): StockSet {
  const family = layoutFamily(theme.industry);
  const set = base ?? curatedStockSet(family);
  const seed = themeImagerySeed(theme.key);
  const out = { category: set.category } as StockSet;
  STOCK_SLOTS.forEach((slot, i) => {
    out[slot] = rotateStockSlot(set[slot], seed + i * 2);
  });
  return out;
}

/**
 * The Unsplash photos a marketplace theme shows in empty image slots (hero, story, tiles,
 * product placeholders), flattened in slot order, each with its photographer credit. PURE and
 * synchronous (curated pool), for the Media Library and theme previews; the storefront may use a
 * fresher API result for the same queries (theme/server/imagery.ts getThemeUnsplashImages).
 *
 * Rotation is keyed by `theme.key` so themes that share a layout family still look different.
 */
export function themeUnsplashImages(theme: Pick<MarketplaceTheme, "key" | "industry">): StockImage[] {
  const set = themeStockSet(theme);
  return STOCK_SLOTS.flatMap((slot: StockSlot) => set[slot]);
}

/** First hero photo for card/onboarding thumbs when no screenshot was captured. PURE. */
export function themeHeroStock(theme: Pick<MarketplaceTheme, "key" | "industry">): StockImage | null {
  return themeStockSet(theme).hero[0] ?? null;
}

/**
 * Per-theme card image (hero, rotated by theme key). Prefer this over a shared industry photo so
 * marketplace and onboarding cards in one category look different. PURE.
 */
export function themeCardImage(theme: Pick<MarketplaceTheme, "key" | "industry">, width = 800): ThemeCardImage | null {
  const hero = themeHeroStock(theme);
  if (!hero) return null;
  return {
    url: `${sizedStockUrl(hero.url, width)}&h=500&fit=crop&crop=entropy`,
    alt: hero.alt,
    photographer: hero.photographer,
    unsplashUrl: hero.unsplashUrl,
    source: hero.source,
  };
}

/** Absolute or site-relative thumb URL for onboarding theme options (stock hero). PURE. */
export function themeStockThumbUrl(theme: Pick<MarketplaceTheme, "key" | "industry">): string | null {
  const hero = themeHeroStock(theme);
  return hero ? sizedStockUrl(hero.url, 480) : null;
}
