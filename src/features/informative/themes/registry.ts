import { nexusCore } from "./nexus-core/theme.config";
import { auraOne } from "./aura-one/theme.config";
import { zenithPrime } from "./zenith-prime/theme.config";
import { prismDeck } from "./prism-deck/theme.config";
import { ascentPeak } from "./ascent-peak/theme.config";
import { vibeShift } from "./vibe-shift/theme.config";
import { neonSlate } from "./neon-slate/theme.config";
import { styleCapital } from "./style-capital/theme.config";
import { pureGold } from "./pure-gold/theme.config";
import { radiantAlpha } from "./radiant-alpha/theme.config";
import { smoothWave } from "./smooth-wave/theme.config";
import type { InfoCategory } from "../categories";
import type { ThemeConfig } from "./types";

/**
 * Informative theme registry (docs/informative/PLAN.md §5). A SEPARATE registry from the store
 * marketplace (features/theme/marketplace): store themes are neither reused nor edited.
 * Import only from informative routes (never from the proxy, root layout, marketing or root sitemap).
 */
export const INFORMATIVE_THEMES: readonly ThemeConfig[] = [nexusCore, auraOne, zenithPrime, prismDeck, ascentPeak, vibeShift, neonSlate, styleCapital, pureGold, radiantAlpha, smoothWave];

export const DEFAULT_THEME_ID = "nexus-core";
/** Plan: "If no match, recommend Nexus Core and Smooth Wave." */
export const FALLBACK_THEME_IDS = ["nexus-core", "smooth-wave"] as const;

export function findInformativeTheme(id: string | null | undefined): ThemeConfig | null {
  return INFORMATIVE_THEMES.find((t) => t.id === id) ?? null;
}

/** The theme to render: the stored one, or the default when it is unknown (renamed / removed). */
export function themeOrDefault(id: string | null | undefined): ThemeConfig {
  return findInformativeTheme(id) ?? findInformativeTheme(DEFAULT_THEME_ID)!;
}

/**
 * 1–2 recommended themes for a category: themes whose demo is that category first, specialists
 * before generalists, then registry order. "Other" and unknown categories get the plan's fallback.
 */
export function recommendedThemeIds(category: InfoCategory | string | null | undefined): string[] {
  if (!category || category === "other") return [...FALLBACK_THEME_IDS];
  const matches = INFORMATIVE_THEMES.filter((t) => (t.recommendedCategories as readonly string[]).includes(category));
  if (!matches.length) return [...FALLBACK_THEME_IDS];
  // Demo-category match first, then specialists (fewer recommended categories), then registry order.
  const score = (t: ThemeConfig) => (t.demoCategory === category ? 0 : 100) + t.recommendedCategories.length;
  const ranked = matches.map((t, i) => ({ t, i })).sort((a, b) => score(a.t) - score(b.t) || a.i - b.i).map((x) => x.t);
  return ranked.slice(0, 2).map((t) => t.id);
}
