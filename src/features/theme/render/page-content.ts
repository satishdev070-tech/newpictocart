import type { TemplateKey, ThemeConfig } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { SectionInstance } from "@/features/theme/sections/types";
import type { AccountPack, PageChrome } from "@/features/theme/sections/variants";

/**
 * Parsed PageContent marker settings (shop chrome + members account pack). Defaults match the
 * section schema so themes saved before these fields keep the classic look.
 */

export type PageContentSettings = {
  chrome: PageChrome;
  pack: AccountPack;
  imagePath: string;
};

const defaults = (): PageContentSettings => SECTION_DEFINITIONS.PageContent.schema.parse({}) as PageContentSettings;

export function pageContentSettings(marker: SectionInstance | undefined | null): PageContentSettings {
  if (!marker || marker.type !== "PageContent") return defaults();
  return SECTION_DEFINITIONS.PageContent.schema.parse(marker.settings ?? {}) as PageContentSettings;
}

export function pageContentMarker(list: readonly SectionInstance[] | undefined): SectionInstance | undefined {
  return list?.find((s) => s.type === "PageContent");
}

export function templatePageContent(theme: ThemeConfig, template: TemplateKey): PageContentSettings {
  return pageContentSettings(pageContentMarker(theme.templates[template]));
}

/** CSS class hooks for shop template body chrome (TemplateFrame + listing/PDP wrappers). */
export function pageChromeClass(chrome: PageChrome): string {
  return `sf-page-chrome sf-page-chrome-${chrome}`;
}
