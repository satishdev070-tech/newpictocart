import "server-only";
import { MARKETPLACE_THEMES, findMarketplaceTheme } from "./catalog";
import type { MarketplaceTheme } from "./types";
import { publishedCustomThemes } from "../builder/server/store";

/**
 * The full marketplace for sellers: built-in themes (code) plus custom themes published from
 * Super Admin → Themes (public.themes, RLS: published rows only). Built-in keys always win.
 */
export async function getMarketplaceThemes(): Promise<readonly MarketplaceTheme[]> {
  const custom = await publishedCustomThemes();
  return custom.length ? [...MARKETPLACE_THEMES, ...custom] : MARKETPLACE_THEMES;
}

/** A built-in theme, else a published custom theme; null when neither exists. */
export async function findAnyMarketplaceTheme(key: string): Promise<MarketplaceTheme | null> {
  return findMarketplaceTheme(key) ?? (await publishedCustomThemes()).find((t) => t.key === key) ?? null;
}
