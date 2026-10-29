import "server-only";
import { cachedStorefront, storefrontTag } from "@/lib/cache/storefront";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { STOCK_SLOTS, getStockSet, type StockImage, type StockSet } from "@/lib/unsplash";
import { logger } from "@/lib/observability/logger";
import type { Storefront } from "@/features/storefront/server/context";
import { findAnyMarketplaceTheme } from "../marketplace/registry";
import { themeStockSet } from "../layouts/imagery";
import { PROTECTED_TENANT_IDS, SHOWCASE_STORES } from "../marketplace/showcase";

/** The store's category slug (stores.category_id → store_categories), cached per tenant. */
const loadStoreCategory = cachedStorefront(
  "store-category",
  async (tenantId: string): Promise<string | null> => {
    const { data, error } = await createSupabasePublicClient().from("stores").select("category:store_categories(slug)").eq("tenant_id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    const cat = data?.category as { slug?: string } | { slug?: string }[] | null | undefined;
    return (Array.isArray(cat) ? cat[0]?.slug : cat?.slug) ?? null;
  },
  (tenantId) => [storefrontTag(tenantId)],
);

/**
 * Photo category for the theme's stock imagery: the theme's own choice, else the theme being
 * live-previewed, else the showcase store's industry, else the store's category ("general").
 */
export async function stockCategoryFor(sf: Storefront): Promise<string | null> {
  const pref = sf.theme.tokens.imagery;
  if (pref === "off" || PROTECTED_TENANT_IDS.has(sf.tenant.tenantId.toLowerCase())) return null;
  if (pref !== "auto") return pref;
  if (sf.themePreview) {
    const theme = await findAnyMarketplaceTheme(sf.themePreview.key);
    if (theme) return theme.industry;
  }
  const showcase = SHOWCASE_STORES[sf.tenant.slug];
  if (showcase) return showcase.industry;
  try {
    return (await loadStoreCategory(sf.tenant.tenantId)) ?? "general";
  } catch (e) {
    logger.warn("theme.store_category_failed", { tenantId: sf.tenant.tenantId, error: e instanceof Error ? e.message : String(e) });
    return "general";
  }
}

/** Stock photos for the storefront's empty image slots, or null when turned off. Never throws. */
export async function getStorefrontStock(sf: Storefront): Promise<StockSet | null> {
  const category = await stockCategoryFor(sf);
  return category ? getStockSet(category) : null;
}

/**
 * The Unsplash photos a marketplace theme uses (API results when UNSPLASH_ACCESS_KEY is set, else
 * the curated pool), rotated per theme key so same-industry themes stay distinct. Null for an
 * unknown theme key.
 */
export async function getThemeUnsplashImages(themeKey: string): Promise<StockImage[] | null> {
  const theme = await findAnyMarketplaceTheme(themeKey);
  if (!theme) return null;
  const base = await getStockSet(theme.industry);
  const set = themeStockSet(theme, base);
  return STOCK_SLOTS.flatMap((slot) => set[slot]);
}
