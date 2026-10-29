/**
 * Site mode (pure, unit tested): what kind of website a store is.
 *
 * - "ecommerce" (default, every existing store): the full online store.
 * - "informative": a business / brochure website (consultant, studio, clinic, restaurant...).
 *   No online checkout: the storefront hides the cart, wishlist and customer-account entry points
 *   and their routes return the store's 404; product/collection pages stay reachable only while
 *   the store still has products (a seller may link a catalogue on purpose); contact forms and
 *   enquiry CTAs are unaffected. The dashboard hides commerce-only screens.
 *
 * Switching modes never deletes anything: products, orders and settings are kept and come back
 * when the store is switched to eCommerce again. Stored in `stores.site_mode` (migration 3300);
 * a missing column or unknown value always reads as "ecommerce", so stores render identically.
 */

export const SITE_MODES = ["ecommerce", "informative"] as const;
export type SiteMode = (typeof SITE_MODES)[number];
export const DEFAULT_SITE_MODE: SiteMode = "ecommerce";

export const SITE_MODE_LABELS: Record<SiteMode, { title: string; description: string }> = {
  informative: { title: "Informative website", description: "A website for your business, services or portfolio. Visitors learn about you and get in touch; no online checkout." },
  ecommerce: { title: "Online store", description: "Sell products online with a cart, checkout, payments and orders." },
};

export function isSiteMode(v: unknown): v is SiteMode {
  return typeof v === "string" && (SITE_MODES as readonly string[]).includes(v);
}

/** Any stored value -> a mode. Missing / unknown / malformed = "ecommerce". */
export function parseSiteMode(v: unknown): SiteMode {
  return isSiteMode(v) ? v : DEFAULT_SITE_MODE;
}

export const isInformative = (mode: SiteMode | null | undefined): boolean => mode === "informative";

// ---- Storefront routes -------------------------------------------------------------------------

/**
 * Storefront route families affected by the mode. "shop" = cart, checkout, customer account
 * (login, orders, wishlist); "catalog" = product listings (collections, categories).
 */
export type SiteRoute = "cart" | "checkout" | "account" | "catalog";

/** Whether a storefront route is served. Informative: shop routes 404; catalog only with products. */
export function siteRouteAllowed(mode: SiteMode | null | undefined, route: SiteRoute, hasProducts: boolean): boolean {
  if (!isInformative(mode)) return true;
  return route === "catalog" ? hasProducts : false;
}

// ---- Header ------------------------------------------------------------------------------------

type HeaderCommerceFlags = { showCart: boolean; showWishlist: boolean; showAccount: boolean; bottomNav: boolean };

/**
 * The theme header with commerce icons forced off in informative mode (the seller's own flags
 * are the default and are kept in the theme, so switching back restores them). The mobile
 * bottom nav is made of shop links only, so it is hidden too.
 */
export function effectiveHeader<H extends HeaderCommerceFlags>(header: H, mode: SiteMode | null | undefined): H {
  if (!isInformative(mode)) return header;
  return { ...header, showCart: false, showWishlist: false, showAccount: false, bottomNav: false };
}

// ---- Dashboard navigation ----------------------------------------------------------------------

/**
 * Dashboard screens that only make sense with online checkout. Hidden from the sidebar in
 * informative mode (the pages still work by URL, and nothing is deleted). Products, collections
 * and categories stay: an informative site may still show a catalogue or portfolio.
 */
export const COMMERCE_ONLY_HREFS: readonly string[] = [
  "/dashboard/inventory",
  "/dashboard/size-charts",
  "/dashboard/orders",
  "/dashboard/payments",
  "/dashboard/returns",
  "/dashboard/discounts",
  "/dashboard/abandoned-carts",
  "/dashboard/settings/payments",
  "/dashboard/settings/checkout",
  "/dashboard/settings/shipping",
  "/dashboard/settings/taxes",
];

/** Nav groups for a mode: commerce-only items removed in informative mode, empty groups dropped. */
export function navForSiteMode<I extends { href: string }, G extends { items: I[] }>(groups: G[], mode: SiteMode | null | undefined): G[] {
  if (!isInformative(mode)) return groups;
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !COMMERCE_ONLY_HREFS.includes(i.href)) })).filter((g) => g.items.length > 0);
}

// ---- Site builder ------------------------------------------------------------------------------

/** Site builder page groups shown for a mode (informative hides eCommerce and Members). */
export function builderGroupVisible(group: string, mode: SiteMode | null | undefined): boolean {
  return !(isInformative(mode) && (group === "ecommerce" || group === "members"));
}

// ---- Marketplace -------------------------------------------------------------------------------

/**
 * Marketplace hand-off:
 * - Informative preset + empty ecommerce store → informative (brochure) mode.
 * - Preserve merchant-chosen informative mode even when an ecommerce preset is applied during
 *   `/start` seed (theme kind does not override an explicit informative choice).
 * - Stores with products that are already ecommerce stay ecommerce when an informative preset is applied.
 */
export function modeAfterThemeApply(current: SiteMode, themeKind: unknown, hasProducts: boolean): SiteMode {
  if (current === "informative") return "informative";
  if (themeKind === "informative" && !hasProducts) return "informative";
  return current;
}
