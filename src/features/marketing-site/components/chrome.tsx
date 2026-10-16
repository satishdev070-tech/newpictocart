import Link from "next/link";
import type React from "react";
import { ArrowRight } from "lucide-react";
import { PLATFORM_NAME } from "@/config/platform";
import { SECTION_IDS } from "../content";
import { analyticsAttributes } from "../analytics";
import { whatsappHref, type LandingContent } from "../landing";
import { BrandLogo } from "./brand-logo";
import { MobileNav } from "./mobile-nav";
import { SocialIcons } from "./landing-icons";
import { ButtonLink, Container } from "./ui";

/** Header and footer for every marketing page. Links and labels come from the landing CMS. */

const isExternal = (href: string) => /^https:\/\//.test(href);

export function MarketingHeader({ header }: { header: LandingContent["header"] }) {
  const ctaHref = header.ctaHref || "/seller/register";
  const loginHref = header.loginHref || "/seller/login";
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
                <Link href={l.href} className="rounded-full px-4 py-2 font-medium text-brand-ink/80 hover:bg-brand-canvas hover:text-brand-ink" {...analyticsAttributes("nav_click", l.label, "header")}>
                  {l.label}
                </Link>
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
          <MobileNav links={header.nav} loginHref={loginHref} signupHref={ctaHref} ctaLabel={header.ctaLabel || "Start Free"} />
        </div>
      </Container>
    </header>
  );
}

const SOCIAL_LABELS = { instagram: "Instagram", x: "X (Twitter)", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" } as const;

export function MarketingFooter({ footer }: { footer: LandingContent["footer"] }) {
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => footer.socials[k]);
  const wa = whatsappHref(footer.whatsapp, footer.whatsappMessage);
  return (
    <>
      <footer className="bg-[#070616] text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_repeat(var(--cols),1fr)]" style={{ "--cols": Math.max(1, footer.groups.length) } as React.CSSProperties}>
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandLogo tone="light" />
            {footer.tagline ? <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">{footer.tagline}</p> : null}
          </div>
          {footer.groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <p className="text-sm font-semibold">{g.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/65">
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    {isExternal(l.href) ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-brand-accent">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-brand-accent">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-white/10">
          <Container className="flex flex-wrap items-center justify-between gap-4 py-6 text-xs text-white/55">
            <p>
              © {new Date().getFullYear()} {footer.copyright || PLATFORM_NAME}
            </p>
            {socials.length ? (
              <ul className="flex items-center gap-3">
                {socials.map((k) => {
                  const Icon = SocialIcons[k];
                  return (
                    <li key={k}>
                      <a href={footer.socials[k]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k]} className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-accent">
                        <Icon className="size-[18px]" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>Made in India</p>
            )}
          </Container>
        </div>
      </footer>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="fixed right-5 bottom-5 z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_30px_-8px_rgb(37_211_102/0.7)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366] motion-reduce:hover:scale-100"
          {...analyticsAttributes("cta_click", "whatsapp", "floating")}
        >
          <SocialIcons.whatsapp className="size-7" />
        </a>
      ) : null}
    </>
  );
}
