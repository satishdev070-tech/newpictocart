import "server-only";
import { brandImageView, getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { PLATFORM_LOGO, PLATFORM_NAME } from "@/config/platform";
import { INFORMATIVE_THEMES } from "../themes/registry";
import type { OnboardingLogo } from "../onboarding/components/shell";
import type { ThemeCard } from "../onboarding/components/theme-step";

/** Same platform logo as /start. */
export async function onboardingLogo(): Promise<OnboardingLogo> {
  const config = await getPublicPlatformConfig();
  const uploaded = brandImageView(config.headerLogo);
  return {
    src: uploaded?.src ?? PLATFORM_LOGO?.src ?? "",
    width: uploaded?.width ?? PLATFORM_LOGO?.width ?? null,
    height: uploaded?.height ?? PLATFORM_LOGO?.height ?? null,
    name: PLATFORM_NAME,
  };
}

/** Plain theme cards for the client (no config objects cross the boundary). */
export function themeCards(): ThemeCard[] {
  return INFORMATIVE_THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    bestFor: t.bestFor,
    tagline: t.tagline,
    // Distinct colours only (several themes reuse one colour as secondary and accent).
    swatches: [...new Set([t.tokens.colors.primary, t.tokens.colors.secondary, t.tokens.colors.accent, t.tokens.colors.background].map((c) => c.toUpperCase()))],
  }));
}
