import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PageSection } from "../sections";
import { themeCssVars } from "../themes/tokens";
import type { ThemeConfig } from "../themes/types";
import { FloatingContact, SiteFooter, SiteHeader } from "./chrome";
import { SectionList } from "./sections";
import { container, heading } from "./ui";
import type { SiteView } from "./view";

/**
 * InformativeSiteRenderer: one theme config + one SiteView + a page's sections → the full page.
 * Tokens become CSS variables on this root (seller overrides included), so the same components
 * render all 11 themes. `fontClassName` comes from src/app/informative-fonts.ts (route level).
 */
export function InformativeSite({
  theme,
  view,
  sections,
  pageTitle,
  fontClassName,
  before,
  banner,
}: {
  theme: ThemeConfig;
  view: SiteView;
  sections: PageSection[];
  /** Non-home pages get a page header with the page's h1 (home's h1 is in the hero). */
  pageTitle?: string | null;
  fontClassName?: string;
  /** Page-specific content rendered before the sections (e.g. a service's details). */
  before?: ReactNode;
  /** Shown above the header (e.g. the owner's draft-preview notice). */
  banner?: ReactNode;
}) {
  const style = themeCssVars(theme, view.overrides) as CSSProperties;
  const startsWithHero = !pageTitle && sections.find((s) => s.visible)?.type === "hero";
  const overHero = startsWithHero && theme.layout.header === "transparent" && theme.layout.hero === "fullBleedImage";
  return (
    <div
      data-informative-theme={theme.id}
      style={style}
      className={cn(fontClassName, "relative flex min-h-dvh flex-col bg-(--if-bg) text-(--if-text) antialiased [font-family:var(--if-font-body)]", theme.tokens.dark && "[color-scheme:dark]")}
    >
      <a href="#if-main" className="sr-only z-50 bg-(--if-surface) p-2 text-(--if-text) focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
        Skip to content
      </a>
      {banner}
      <SiteHeader theme={theme} view={view} overHero={overHero} />
      <main id="if-main" className="flex-1">
        {pageTitle ? (
          <div className="border-b border-(--if-border) bg-(--if-surface) px-4 py-12 sm:px-6">
            <h1 className={cn(container, heading, "text-4xl font-bold sm:text-5xl")}>{pageTitle}</h1>
          </div>
        ) : !sections.some((s) => s.visible && s.type === "hero") ? (
          // Every page keeps exactly one h1: without a page title or a visible hero, name the site.
          <h1 className="sr-only">{view.businessName}</h1>
        ) : null}
        {before}
        <SectionList theme={theme} view={view} sections={sections} />
      </main>
      <SiteFooter theme={theme} view={view} />
      <FloatingContact view={view} />
    </div>
  );
}
