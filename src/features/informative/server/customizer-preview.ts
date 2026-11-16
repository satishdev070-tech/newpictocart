import { defaultPageSections } from "../defaults";
import { customizerSchema, type CustomizerInput } from "../schemas";
import type { PageSection } from "../sections";
import { applyHeroText, applySectionLayout } from "../site/customize";
import { themeOrDefault } from "../themes/registry";
import type { ThemeConfig } from "../themes/types";
import type { SiteBundle } from "./public";

/**
 * Customizer live preview (pure). The Customizer iframe sends its UNSAVED state as `?c=<json>`;
 * it is validated with the same schema as a save and laid over the member's draft bundle, so the
 * preview shows exactly what saving would show. Nothing is written.
 */
export function parseCustomizerDraft(raw: string | string[] | undefined): CustomizerInput | null {
  if (typeof raw !== "string" || raw.length > 8000) return null;
  try {
    const r = customizerSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function customizerPreview(bundle: SiteBundle, draft: CustomizerInput | null): { bundle: SiteBundle; theme: ThemeConfig; sections: PageSection[] } {
  const site = draft
    ? {
        ...bundle.site,
        themeId: draft.themeId,
        primaryColor: draft.primaryColor ?? null,
        secondaryColor: draft.secondaryColor ?? null,
        fontPair: draft.fontPair ?? null,
        logoPath: draft.logoPath ?? null,
        faviconPath: draft.faviconPath ?? null,
        heroImagePath: draft.heroImagePath ?? null,
      }
    : bundle.site;
  const theme = themeOrDefault(site.themeId);
  const home = bundle.pages.find((p) => p.type === "HOME");
  const base = home?.sections.length ? home.sections : defaultPageSections(theme, "HOME");
  const sections = draft?.home ? applyHeroText(applySectionLayout(base, draft.home), { heading: draft.heroHeading, subheading: draft.heroSubheading }) : base;
  const customize = draft ? { ctaLabel: draft.ctaLabel ?? null } : bundle.customize;
  return { bundle: { ...bundle, site, customize }, theme, sections };
}
