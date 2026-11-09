import Link from "next/link";
import { PLATFORM_NAME } from "@/config/platform";
import { cn } from "@/lib/cn";
import { analyticsAttributes } from "../analytics";
import { SOCIAL_KEYS, SOCIAL_LABELS } from "../chrome-content";
import { whatsappHref, type LandingContent } from "../landing";
import { BrandLogo } from "./brand-logo";
import { BRAND_CHIP, BrandIcons } from "./chrome-icons";
import { SocialIcons } from "./landing-icons";
import { ShareButton } from "./share-button";

/**
 * Dark editorial footer for every marketing page: link columns (one link can be highlighted),
 * then logo, copyright, share button and social profiles. Oversized faded wordmark anchors the
 * bottom. Content from the landing CMS.
 */

const isExternal = (href: string) => /^https:\/\//.test(href);

export function MarketingFooter({ footer }: { footer: LandingContent["footer"] }) {
  const socials = SOCIAL_KEYS.filter((k) => footer.socials[k]);
  const wa = whatsappHref(footer.whatsapp, footer.whatsappMessage);
  const share = footer.share.enabled && footer.share.networks.length ? footer.share : null;
  return (
    <>
      <footer className="relative overflow-hidden bg-mk-bg text-mk-text">
        <div className="mk-container relative z-10 pt-14 pb-8 sm:pt-16">
          {footer.groups.length ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" style={{ "--cols": footer.groups.length } as React.CSSProperties}>
              {footer.groups.map((g) => (
                <nav key={g.title} aria-label={g.title}>
                  <p className="mk-label text-mk-muted">{g.title}</p>
                  <ul className="mt-5 space-y-3 text-[0.95rem]">
                    {g.links.map((l) => {
                      const cls = cn(
                        "rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
                        l.highlight ? "font-semibold text-mk-accent hover:text-mk-accent-hover" : "text-mk-muted hover:text-mk-text",
                      );
                      return (
                        <li key={l.href + l.label}>
                          {isExternal(l.href) ? (
                            <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
                              {l.label}
                            </a>
                          ) : (
                            <Link href={l.href} prefetch className={cls}>
                              {l.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              ))}
            </div>
          ) : null}
          {footer.tagline ? <p className="mt-10 max-w-xl text-sm leading-relaxed text-mk-dim">{footer.tagline}</p> : null}

          {/* Room for the floating WhatsApp button so it never covers the social icons. */}
          <div className={cn("mt-10 grid items-center gap-6 border-t border-mk-line pt-8 text-center lg:grid-cols-[auto_1fr_auto] lg:gap-8 lg:text-left", wa && "pb-16 lg:pr-16 lg:pb-0")}>
            <BrandLogo tone="light" className="justify-self-center lg:justify-self-start" />
            <p className="text-sm text-mk-muted lg:text-center">
              © {new Date().getFullYear()} {footer.copyright || `${PLATFORM_NAME}. All rights reserved.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
              {share ? <ShareButton label={share.label || "Share"} text={share.text} networks={share.networks} /> : null}
              {socials.length ? (
                <ul className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Follow us">
                  {socials.map((k) => {
                    const Icon = BrandIcons[k];
                    return (
                      <li key={k}>
                        <a
                          href={footer.socials[k]}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={SOCIAL_LABELS[k]}
                          title={SOCIAL_LABELS[k]}
                          className={cn(
                            "grid size-8 place-items-center rounded-full shadow-[0_6px_16px_-8px_rgb(0_0_0/0.8)] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent motion-reduce:transition-none motion-reduce:hover:transform-none",
                            BRAND_CHIP[k],
                          )}
                          {...analyticsAttributes("nav_click", `social_${k}`, "footer")}
                        >
                          <Icon className="size-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
        <p
          aria-hidden
          className="pointer-events-none relative z-0 mt-4 select-none overflow-hidden text-center font-mk-display text-[12vw] leading-none font-bold tracking-[-0.04em] text-mk-text opacity-[0.08]"
        >
          {PLATFORM_NAME.toUpperCase()}
        </p>
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
