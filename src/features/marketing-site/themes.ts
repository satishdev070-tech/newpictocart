import { ecommerceMarketplaceThemes, MARKETPLACE_THEMES, type MarketplaceTheme } from "@/features/theme/marketplace/catalog";
import { themeSiteType, type ThemeSiteType } from "@/features/theme/marketplace/types";
import { INDUSTRIES, isIndustry, industryShort, type IndustrySlug } from "@/features/stores/industries";
import { INDUSTRY_SHOWCASE, SHOWCASE_STORES } from "@/features/theme/marketplace/showcase";

/**
 * Public view of the theme marketplace catalogue (pure, unit tested). The catalogue is code, not
 * merchant data, so listing it never touches a store. Premium/free labels are deliberately absent:
 * the catalogue has no per-theme entitlement, only the plan-level `theme_marketplace` flag.
 *
 * Discovery defaults to ecommerce themes only (informative temporarily hidden). `findTheme` still
 * resolves any built-in key so deep links / apply paths keep working.
 */

export const THEMES_PER_PAGE = 24;

/** `siteType` is optional for compatibility with internal callers created before this filter. */
export type ThemeQuery = { q: string; industry: IndustrySlug | ""; siteType?: ThemeSiteType | ""; page: number };

/** Normalises untrusted search params. Informative filter is ignored while that mode is hidden. */
export function parseThemeQuery(sp: Record<string, string | string[] | undefined>): ThemeQuery {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const q = one(sp.q).trim().slice(0, 60);
  const industry = one(sp.industry);
  const siteType = one(sp.type);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    q,
    industry: isIndustry(industry) ? industry : "",
    siteType: siteType === "ecommerce" ? "ecommerce" : "",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 50) : 1,
  };
}

function matches(t: MarketplaceTheme, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [t.name, t.tagline, t.description, industryShort(t.industry), t.style, ...t.bestFor].some((s) => s.toLowerCase().includes(needle));
}

export function filterThemes(query: ThemeQuery, themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes()) {
  const all = themes.filter((t) => (!query.industry || t.industry === query.industry) && (!query.siteType || themeSiteType(t) === query.siteType) && matches(t, query.q));
  const pages = Math.max(1, Math.ceil(all.length / THEMES_PER_PAGE));
  const page = Math.min(query.page, pages);
  return { total: all.length, page, pages, items: all.slice((page - 1) * THEMES_PER_PAGE, page * THEMES_PER_PAGE) };
}

/** Industries that have at least one theme, with counts, in INDUSTRIES order. */
export function themeIndustries(themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes(), siteType: ThemeSiteType | "" = "") {
  const counts = new Map<string, number>();
  for (const t of themes) if (!siteType || themeSiteType(t) === siteType) counts.set(t.industry, (counts.get(t.industry) ?? 0) + 1);
  return INDUSTRIES.filter((i) => counts.has(i.slug)).map((i) => ({ slug: i.slug, label: i.short, count: counts.get(i.slug)! }));
}

export function findTheme(key: string): MarketplaceTheme | undefined {
  return MARKETPLACE_THEMES.find((t) => t.key === key);
}

export function isThemeKey(key: string | null | undefined): key is string {
  return !!key && /^[a-z0-9-]{2,40}$/.test(key) && !!findTheme(key);
}

/** First theme of each listed industry, for the home page showcase (varied, deterministic). */
export function showcaseThemes(industries: readonly string[], themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes()): MarketplaceTheme[] {
  return industries.flatMap((slug) => {
    const t = themes.find((x) => x.industry === slug);
    return t ? [t] : [];
  });
}

/** A representative theme for a business category card. */
export function themeForIndustry(slug: string, themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes()): MarketplaceTheme | undefined {
  // Prefer a theme with a demo store, so the category card can show it live.
  return themes.find((t) => t.industry === slug && t.demo) ?? themes.find((t) => t.industry === slug);
}

export function themeCountFor(slug: string, themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes()): number {
  return themes.filter((t) => t.industry === slug).length;
}

/** Ecommerce themes listed on the public marketplace (mega-menu copy, stats). */
export function marketplaceThemeCount(themes: readonly MarketplaceTheme[] = ecommerceMarketplaceThemes()): number {
  return themes.length;
}

/** URL of the public themes page with the given filters (page 1 omitted). */
export function themesHref(q: Partial<ThemeQuery>): string {
  const qs = new URLSearchParams();
  if (q.q) qs.set("q", q.q);
  if (q.industry) qs.set("industry", q.industry);
  if (q.siteType) qs.set("type", q.siteType);
  if (q.page && q.page > 1) qs.set("page", String(q.page));
  return qs.size ? `/themes?${qs}` : "/themes";
}

/** Industries in the home page theme showcase, in order: one theme each (first `count` are shown). */
export const SHOWCASE_INDUSTRIES = ["fashion", "gourmet", "jewellery", "beauty", "furniture", "electronics", "handicrafts", "general", "grocery", "footwear", "kids", "watches"] as const;

/**
 * Demo (showcase) stores that can show `theme` live, best first: its own demo, then its
 * industry's showcase store, then the general store, then every other showcase store. Live
 * Preview applies any theme in memory on any showcase store, so a theme still gets a real preview
 * when its own demo store hasn't been built yet. PURE.
 */
export function previewDemoCandidates(theme: Pick<MarketplaceTheme, "demo" | "industry">): string[] {
  const first = [theme.demo, INDUSTRY_SHOWCASE[theme.industry], INDUSTRY_SHOWCASE.general].filter((s): s is string => !!s);
  return [...new Set([...first, ...Object.keys(SHOWCASE_STORES)])];
}

/** The best live demo store for `theme`, or null when none of the candidates is live. PURE. */
export function pickPreviewDemo(theme: Pick<MarketplaceTheme, "demo" | "industry">, live: ReadonlySet<string>): string | null {
  return previewDemoCandidates(theme).find((s) => live.has(s)) ?? null;
}

/** On-site preview page of a theme (works for every theme: live demo store or sample store). */
export const themePreviewHref = (key: string) => `/themes/${key}/preview`;
