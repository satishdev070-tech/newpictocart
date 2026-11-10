import {
  STOCK_SLOTS,
  curatedStockSet,
  sizedStockUrl,
  uniqueStockOffset,
  type StockImage,
  type StockSet,
  type StockSlot,
} from "@/lib/unsplash-stock";
import { layoutFamily } from "./personalities";
import { stockPeerKeys } from "../marketplace/stock-peers";
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
 * Exclusive hero offset for a marketplace theme among peers in the same Unsplash category.
 * Prefer this over hashing the key alone — hash modulo a small pool made fashion themes share
 * ~3 heroes. PURE; pass `peerKeys` to avoid the catalogue (defaults to lightweight stock-peers).
 */
export function themeHeroOffset(
  themeKey: string,
  industry: string,
  poolLen: number,
  peerKeys?: readonly string[],
): number {
  const peers = peerKeys ?? stockPeerKeys(layoutFamily(industry));
  return uniqueStockOffset(themeKey, peers, poolLen);
}

/** @deprecated Use themeHeroOffset — kept for callers that only need a stable numeric seed. */
export function themeImagerySeed(themeKey: string, industry = "general", poolLen = 1): number {
  return themeHeroOffset(themeKey, industry, Math.max(poolLen, 1));
}

/** Rotate a slot list by a non-negative offset (wraps). PURE. */
export function rotateStockSlot<T>(list: readonly T[], offset: number): T[] {
  if (!list.length) return [];
  const shift = ((offset % list.length) + list.length) % list.length;
  if (shift === 0) return [...list];
  return list.map((_, i) => list[(i + shift) % list.length]!);
}

/**
 * Per-theme view of a category stock set: hero uses an exclusive offset among marketplace peers;
 * other slots use `heroOffset + slotStep` over their (larger) pools to limit cross-theme repeats.
 * PURE.
 */
export function themeStockSet(
  theme: Pick<MarketplaceTheme, "key" | "industry">,
  base?: StockSet,
  peerKeys?: readonly string[],
): StockSet {
  const family = layoutFamily(theme.industry);
  const set = base ?? curatedStockSet(family);
  const peers = peerKeys ?? stockPeerKeys(family);
  const heroOffset = themeHeroOffset(theme.key, theme.industry, set.hero.length, peers);
  const out = { category: set.category } as StockSet;
  STOCK_SLOTS.forEach((slot, i) => {
    out[slot] = rotateStockSlot(set[slot], heroOffset + i);
  });
  return out;
}

/**
 * The Unsplash photos a marketplace theme shows in empty image slots (hero, story, tiles,
 * product placeholders), flattened in slot order, each with its photographer credit. PURE and
 * synchronous (curated pool), for the Media Library and theme previews; the storefront may use a
 * fresher API result for the same queries (theme/server/imagery.ts getThemeUnsplashImages).
 *
 * Rotation uses exclusive peer offsets so themes that share a layout family stay distinct.
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
 * Per-theme card image (exclusive hero among peers). Prefer this over a shared industry photo so
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
