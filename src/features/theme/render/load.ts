import "server-only";
import { cache } from "react";
import { requireStorefront } from "@/features/storefront/server/context";
import { getMenus, resolveThemeMenus } from "@/features/storefront/server/content";
import { getCartCount } from "@/features/cart/queries";
import { getStoreCustomer } from "@/features/customer-account/session";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { canPreviewThemes } from "@/features/theme/marketplace/showcase";
import { getStorefrontStock } from "@/features/theme/server/imagery";
import { markStorefrontPreview } from "@/features/storefront/preview-flag";
import { isInformative } from "@/features/stores/site-mode";
import type { RenderContext } from "./context";

/** Menu handles referenced anywhere in the theme (header setting, MegaMenu, Footer). */
export function menuHandles(theme: ThemeConfig): string[] {
  const set = new Set<string>([theme.header.menuHandle]);
  for (const s of [...theme.layout.header, ...theme.layout.footer]) {
    const st = s.settings as { menuHandle?: unknown; menuHandles?: unknown };
    if (typeof st.menuHandle === "string") set.add(st.menuHandle);
    if (Array.isArray(st.menuHandles)) for (const h of st.menuHandles) if (typeof h === "string") set.add(h);
  }
  return [...set].filter(Boolean).sort();
}

/** Database menus for the theme's handles, with the theme's own menu copies (site builder) on top. */
export async function loadThemeMenus(tenantId: string, theme: ThemeConfig): Promise<RenderContext["menus"]> {
  const [db, own] = await Promise.all([
    getMenus(tenantId, menuHandles(theme).filter((h) => !(h in theme.menus)).join(",")),
    resolveThemeMenus(tenantId, theme.menus, theme.pages.map((p) => p.handle), theme.popups.map((p) => p.id)),
  ]);
  return { ...db, ...own };
}

/** Per-request storefront render context shared by the store layout and pages (memoised). */
export const getRenderContext = cache(async (host: string): Promise<RenderContext> => {
  const sf = await requireStorefront(host);
  // Before any section renders StoreImage: draft/builder preview disables LCP image priority.
  markStorefrontPreview(sf.preview);
  const commerce = !isInformative(sf.siteMode);
  const [menus, cartCount, customer, stock] = await Promise.all([
    loadThemeMenus(sf.tenant.tenantId, sf.theme),
    commerce ? getCartCount(sf.tenant.tenantId) : Promise.resolve(0),
    commerce ? getStoreCustomer(sf.tenant.tenantId) : Promise.resolve(null),
    getStorefrontStock(sf),
  ]);
  const stockProducts = Boolean(stock) && (Boolean(sf.themePreview) || canPreviewThemes(sf.tenant));
  return { sf, menus, cartCount, signedIn: Boolean(customer), stock, stockProducts };
});
