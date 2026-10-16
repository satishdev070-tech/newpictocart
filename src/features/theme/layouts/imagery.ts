import { STOCK_SLOTS, curatedStockSet, type StockImage } from "@/lib/unsplash-stock";
import { layoutFamily } from "./personalities";
import type { MarketplaceTheme } from "../marketplace/types";

/**
 * The Unsplash photos a marketplace theme shows in empty image slots (hero, story, tiles,
 * product placeholders), flattened in slot order, each with its photographer credit. PURE and
 * synchronous (curated pool), for the Media Library and theme previews; the storefront may use a
 * fresher API result for the same queries (theme/server/imagery.ts getThemeUnsplashImages).
 */
export function themeUnsplashImages(theme: Pick<MarketplaceTheme, "industry">): StockImage[] {
  const set = curatedStockSet(layoutFamily(theme.industry));
  return STOCK_SLOTS.flatMap((slot) => set[slot]);
}
