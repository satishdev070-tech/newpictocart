import type { PageSection, PageType, SectionType } from "./sections";
import type { ThemeConfig } from "./themes/types";

/**
 * Default sections for the four system pages of a new site (pure). Home follows the theme's
 * default order; the other pages share one sensible layout per page, with the services style
 * taken from the theme. Used by onboarding (M4) and "reset page".
 */
function servicesSection(theme: ThemeConfig): SectionType {
  return theme.layout.servicesStyle === "list" || theme.layout.servicesStyle === "menu" ? "services_list" : "services_grid";
}

export function defaultSectionTypes(theme: ThemeConfig, page: Exclude<PageType, "CUSTOM">): SectionType[] {
  switch (page) {
    case "HOME":
      return theme.defaultSections;
    case "ABOUT":
      return ["about", "highlights", "stats", "team", "testimonials", "cta"];
    case "SERVICES":
      return [servicesSection(theme), "pricing", "faq", "cta"];
    case "CONTACT":
      return ["contact", "enquiry_form"];
  }
}

export function defaultPageSections(theme: ThemeConfig, page: Exclude<PageType, "CUSTOM">): PageSection[] {
  return defaultSectionTypes(theme, page).map((type, i) => ({ id: `${type}-${i}`, type, props: {}, order: i, visible: true }));
}
