import type { Storefront } from "@/features/storefront/server/context";
import type { MenuNode } from "@/features/storefront/urls";
import type { StockSet } from "@/lib/unsplash-stock";

/** Everything a section renderer may need, resolved once per request by the store layout/page. */
export type RenderContext = {
  sf: Storefront;
  menus: Record<string, { title: string; items: MenuNode[] }>;
  cartCount: number;
  signedIn: boolean;
  /** Unsplash photos for empty image slots (hero, tiles, story...); null when turned off. */
  stock: StockSet | null;
  /** Also fill missing PRODUCT photos with stock (demo stores and Live Preview only, never real stores). */
  stockProducts: boolean;
};
