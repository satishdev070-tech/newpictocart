import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SECTION_IDS } from "../content";
import { analyticsAttributes } from "../analytics";
import type { LandingContent } from "../landing";
import { BrandLogo } from "./brand-logo";
import { MobileNav } from "./mobile-nav";
import { MegaMenu } from "./mega-menu";
import { ButtonLink, Container } from "./ui";

/** Header (and, re-exported, footer) for every marketing page. Links and labels come from the landing CMS. */

export function MarketingHeader({ header }: { header: LandingContent["header"] }) {
  const ctaHref = header.ctaHref || "/start";
  const loginHref = header.loginHref || "/seller/login";
  const mega = header.megaMenu.enabled && header.megaMenu.columns.length ? header.megaMenu : null;
  const isMegaTrigger = (label: string) => mega !== null && label.trim().toLowerCase() === mega.trigger.trim().toLowerCase();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <a href={`#${SECTION_IDS.main}`} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-brand-card">
        Skip to content
      </a>
      <Container className="flex h-[68px] items-center justify-between gap-4 sm:h-[76px] sm:gap-6">
        <BrandLogo size="header" className="shrink-0" />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 text-[0.93rem]">
            {header.nav.map((l) => (
              <li key={l.href + l.label}>
                {mega && isMegaTrigger(l.label) ? (
                  <MegaMenu label={l.label} href={l.href} menu={mega} />
                ) : (
                  <Link href={l.href} prefetch className="rounded-full px-4 py-2 font-medium text-brand-ink/80 transition-colors hover:bg-brand-canvas hover:text-brand-ink" {...analyticsAttributes("nav_click", l.label, "header")}>
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {header.loginLabel ? (
            <Link href={loginHref} className="hidden rounded-full px-4 py-2 text-[0.93rem] font-semibold text-brand-ink hover:bg-brand-canvas sm:inline-flex" {...analyticsAttributes("nav_click", "login", "header")}>
              {header.loginLabel}
            </Link>
          ) : null}
          <ButtonLink href={ctaHref} variant="cta" size="sm" className="hidden h-10 rounded-xl px-5 whitespace-nowrap sm:inline-flex" track={{ id: "create_store", location: "header" }}>
            {header.ctaLabel || "Start Free"} <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
          <MobileNav links={header.nav} loginHref={loginHref} loginLabel={header.loginLabel || "Login"} signupHref={ctaHref} ctaLabel={header.ctaLabel || "Start Free"} megaMenu={mega} />
        </div>
      </Container>
    </header>
  );
}

export { MarketingFooter } from "./site-footer";
