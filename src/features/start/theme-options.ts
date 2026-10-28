/**
 * Slim theme DTOs for the start onboarding Theme screen.
 * Full marketplace presets stay on the server; the client only needs keys for selection
 * plus optional screenshot thumbnails.
 */

export type StartThemeOption = {
  key: string;
  name: string;
  thumbnail?: string;
  industry?: string;
};

export type StartThemeOptions = {
  recommended: StartThemeOption;
  alternatives: StartThemeOption[];
};

/** How many alternative themes to show beside the AI recommendation (3–5). */
export const START_THEME_ALTERNATIVE_COUNT = 4;

export type RankedThemeRef = {
  key: string;
  name: string;
  industry: string;
};

export function toStartThemeOption(theme: RankedThemeRef, thumbnail?: string | null): StartThemeOption {
  return {
    key: theme.key,
    name: theme.name,
    industry: theme.industry,
    ...(thumbnail ? { thumbnail } : {}),
  };
}

/**
 * Pick recommended + alternatives from an already-ranked ecommerce pool
 * (same order as `pickBestMarketplaceTheme` / `listRankedMarketplaceThemes`).
 */
export function selectStartThemeOptions(
  ranked: RankedThemeRef[],
  preferred: RankedThemeRef | null,
  thumbnailFor: (key: string) => string | null | undefined = () => undefined,
): StartThemeOptions {
  const best = ranked[0];
  if (!best) {
    throw new Error("No marketplace themes available");
  }
  const recommendedTheme = preferred ?? best;
  const baseAlts = ranked
    .filter((t) => t.key !== recommendedTheme.key)
    .slice(0, START_THEME_ALTERNATIVE_COUNT)
    .map((t) => toStartThemeOption(t, thumbnailFor(t.key)));

  if (preferred && best.key !== preferred.key) {
    const bestOpt = toStartThemeOption(best, thumbnailFor(best.key));
    const rest = baseAlts.filter((a) => a.key !== bestOpt.key);
    return {
      recommended: toStartThemeOption(recommendedTheme, thumbnailFor(recommendedTheme.key)),
      alternatives: [bestOpt, ...rest].slice(0, START_THEME_ALTERNATIVE_COUNT),
    };
  }

  return {
    recommended: toStartThemeOption(recommendedTheme, thumbnailFor(recommendedTheme.key)),
    alternatives: baseAlts,
  };
}

/** Flatten recommended + alternatives into a single ordered list (recommended first). */
export function flattenStartThemeOptions(options: StartThemeOptions): StartThemeOption[] {
  const seen = new Set<string>();
  const out: StartThemeOption[] = [];
  for (const t of [options.recommended, ...options.alternatives]) {
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t);
  }
  return out;
}
