import "server-only";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import { layoutSummary } from "@/features/theme/layouts/apply-layout";
import { layoutFamily } from "@/features/theme/layouts/personalities";
import { applyMarketplaceThemeToDraft } from "@/features/theme/server/apply-marketplace";
import type { TenantContext } from "@/lib/tenant/membership";
import { AppError } from "@/lib/errors";

/**
 * Theme best-fit for voice onboarding. Mirrors `pickThemes` in scripts/demo/generate.ts:
 * prefer themes for the store's industry, then same layout family, then the rest of the catalogue.
 * Returns the primary (first) marketplace theme — the demo script's "store A" choice.
 */
export function pickBestMarketplaceTheme(industry: string): MarketplaceTheme {
  const own = MARKETPLACE_THEMES.filter((t) => t.industry === industry);
  const family = MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) === layoutFamily(industry));
  const pool = [...own, ...family, ...MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) !== layoutFamily(industry))];
  const primary = pool[0];
  if (!primary) throw new AppError("INTERNAL", { message: `No marketplace theme for industry ${industry}` });
  return primary;
}

/** Same pool/order as pickThemes; exposed for callers that want the secondary layout variant. */
export function pickMarketplaceThemePair(industry: string): [MarketplaceTheme, MarketplaceTheme] {
  const own = MARKETPLACE_THEMES.filter((t) => t.industry === industry);
  const family = MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) === layoutFamily(industry));
  const pool = [...own, ...family, ...MARKETPLACE_THEMES.filter((t) => t.industry !== industry && layoutFamily(t.industry) !== layoutFamily(industry))];
  const a = pool[0];
  if (!a) throw new AppError("INTERNAL", { message: `No marketplace theme for industry ${industry}` });
  const la = layoutSummary(a.preset);
  const rest = pool.slice(1);
  const b =
    rest.find((t) => {
      const lb = layoutSummary(t.preset);
      return lb.hero !== la.hero && lb.products !== la.products;
    }) ?? rest.find((t) => JSON.stringify(layoutSummary(t.preset)) !== JSON.stringify(la));
  if (!b) throw new AppError("INTERNAL", { message: `No second marketplace theme for industry ${industry}` });
  return [a, b];
}

/** Apply the industry best-fit (or an explicit key) as a DRAFT via the shared marketplace helper. */
export async function applyBestFitTheme(ctx: TenantContext, industry: string, themeKey?: string | null): Promise<MarketplaceTheme> {
  const theme = themeKey ? (MARKETPLACE_THEMES.find((t) => t.key === themeKey) ?? null) : pickBestMarketplaceTheme(industry);
  if (!theme) throw new AppError("NOT_FOUND", { message: "That theme isn't in the marketplace." });
  await applyMarketplaceThemeToDraft(ctx, theme.key);
  return theme;
}
