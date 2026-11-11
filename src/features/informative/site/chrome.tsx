import { cn } from "@/lib/cn";
import type { ThemeConfig } from "../themes/types";
import type { SiteView } from "./view";
import { btnPrimary, container, focusRing, heading, Img, telHref, whatsappHref } from "./ui";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Brand({ view, light }: { view: SiteView; light?: boolean }) {
  return (
    <a href={view.nav[0]?.href ?? "/"} className={cn("flex min-h-11 items-center gap-3", focusRing)}>
      {view.logoUrl ? <Img src={view.logoUrl} alt={`${view.businessName} logo`} width={160} height={40} className="h-10 w-auto max-w-40 object-contain" priority /> : null}
      <span className={cn(heading, "text-lg font-semibold", light && "text-white", view.logoUrl && "sr-only sm:not-sr-only")}>{view.businessName}</span>
    </a>
  );
}

function NavLinks({ view, light, className }: { view: SiteView; light?: boolean; className?: string }) {
  return (
    <ul className={className}>
      {view.nav.map((n) => (
        <li key={n.href}>
          <a href={n.href} className={cn("inline-flex min-h-11 items-center px-2 text-sm font-medium hover:underline", light ? "text-white" : "text-(--if-text)", focusRing)}>
            {n.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Mobile nav without JavaScript: a disclosure (details/summary) that is keyboard and screen-reader friendly. */
function MobileMenu({ view, light }: { view: SiteView; light?: boolean }) {
  return (
    <details className="relative md:hidden">
      <summary className={cn("flex min-h-11 cursor-pointer list-none items-center rounded-(--if-radius) px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden", light ? "text-white" : "text-(--if-text)", focusRing)}>
        Menu
      </summary>
      <nav aria-label="Mobile" className="absolute right-0 z-30 mt-2 w-56 rounded-(--if-radius) border border-(--if-border) bg-(--if-surface) p-2 shadow-(--if-shadow)">
        <NavLinks view={view} className="flex flex-col" />
      </nav>
    </details>
  );
}

export function SiteHeader({ theme, view, overHero }: { theme: ThemeConfig; view: SiteView; overHero: boolean }) {
  const light = overHero;
  const variant = theme.layout.header;
  if (variant === "centered") {
    return (
      <header className="border-b border-(--if-border) bg-(--if-bg) px-4 sm:px-6">
        <div className={cn(container, "flex flex-col items-center gap-2 py-4")}>
          <div className="flex w-full items-center justify-between md:justify-center">
            <Brand view={view} />
            <MobileMenu view={view} />
          </div>
          <nav aria-label="Main" className="hidden md:block">
            <NavLinks view={view} className="flex gap-4" />
          </nav>
        </div>
      </header>
    );
  }
  return (
    <header className={cn("px-4 sm:px-6", overHero ? "absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/50 to-transparent" : "border-b border-(--if-border) bg-(--if-bg)")}>
      <div className={cn(container, "flex items-center justify-between gap-4 py-3")}>
        <Brand view={view} light={light} />
        <nav aria-label="Main" className={cn("hidden", variant === "minimal" ? "lg:block" : "md:block")}>
          <NavLinks view={view} light={light} className="flex gap-2" />
        </nav>
        <div className="flex items-center gap-2">
          {/* Wrapper carries the visibility: cn() joins classes without merging, so `hidden` must not share an element with btnPrimary's inline-flex. */}
          <span className="hidden sm:inline">
            <a href={view.nav.find((n) => n.label === "Contact")?.href ?? "/contact"} className={btnPrimary}>
              {view.ctaLabel}
            </a>
          </span>
          <MobileMenu view={view} light={light} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ theme, view }: { theme: ThemeConfig; view: SiteView }) {
  const dark = theme.layout.footer === "dark";
  const tone = dark ? "bg-(--if-secondary) text-(--if-on-secondary)" : "bg-(--if-surface) text-(--if-text)";
  const year = new Date().getFullYear();
  return (
    <footer className={cn("px-4 pt-12 pb-28 sm:px-6 md:pb-12", tone, !dark && "border-t border-(--if-border)")}>
      <div className={cn(container, "grid gap-10", theme.layout.footer === "simple" ? "md:grid-cols-2" : "md:grid-cols-3")}>
        <div>
          <p className={cn(heading, "text-xl font-semibold")}>{view.businessName}</p>
          {view.tagline ? <p className="mt-2 text-sm opacity-90">{view.tagline}</p> : null}
        </div>
        <div className="text-sm">
          <h2 className="mb-2 font-semibold">Contact</h2>
          <ul className="space-y-1">
            {view.contact.phone ? <li><a className={cn("underline-offset-2 hover:underline", focusRing)} href={telHref(view.contact.phone) ?? undefined}>{view.contact.phone}</a></li> : null}
            {view.contact.email ? <li><a className={cn("underline-offset-2 hover:underline", focusRing)} href={`mailto:${view.contact.email}`}>{view.contact.email}</a></li> : null}
            {view.contact.address || view.contact.city ? <li>{view.contact.address ?? view.contact.city}</li> : null}
          </ul>
        </div>
        {theme.layout.footer !== "simple" && view.hours.length ? (
          <div className="text-sm">
            <h2 className="mb-2 font-semibold">Hours</h2>
            <ul className="space-y-1">
              {[...view.hours].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{DAY_NAMES[h.day]}</span>
                  <span>{h.closed ? "Closed" : `${h.open}–${h.close}`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className={cn(container, "mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-current/20 pt-6 text-xs opacity-90")}>
        <p>© {year} {view.businessName}</p>
        {Object.keys(view.socialLinks).length ? (
          <ul className="flex gap-3">
            {Object.entries(view.socialLinks).map(([k, url]) => (
              <li key={k}>
                <a href={url} rel="noopener noreferrer" target="_blank" className={cn("capitalize underline-offset-2 hover:underline", focusRing)}>
                  {k}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {view.credits.length ? (
          <p className="w-full">
            Photos:{" "}
            {view.credits.map((c, i) => (
              <span key={c.url}>
                {i ? ", " : ""}
                <a href={c.url} rel="noopener noreferrer" target="_blank" className="underline">{c.name}</a>
              </span>
            ))}{" "}
            on{" "}
            <a href="https://unsplash.com/?utm_source=pictocart&utm_medium=referral" rel="noopener noreferrer" target="_blank" className="underline">Unsplash</a>
          </p>
        ) : null}
      </div>
    </footer>
  );
}

/** Floating WhatsApp / call buttons (desktop) and a sticky CTA bar (mobile). */
export function FloatingContact({ view }: { view: SiteView }) {
  const wa = whatsappHref(view.contact.whatsapp ?? view.contact.phone, view.businessName);
  const tel = telHref(view.contact.phone);
  if (!wa && !tel) return null;
  return (
    <>
      <div className="fixed right-4 bottom-4 z-30 hidden flex-col gap-2 md:flex">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" data-enquiry-source="WHATSAPP_CLICK" className={cn("rounded-full bg-[#1f7a43] px-4 py-3 text-sm font-semibold text-white shadow-lg", focusRing)}>
            WhatsApp us
          </a>
        ) : null}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-px border-t border-(--if-border) bg-(--if-border) md:hidden">
        {tel ? (
          <a href={tel} className={cn("flex min-h-12 items-center justify-center bg-(--if-surface) text-sm font-semibold text-(--if-text)", focusRing, !wa && "col-span-2")}>
            Call
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" data-enquiry-source="WHATSAPP_CLICK" className={cn("flex min-h-12 items-center justify-center bg-[#1f7a43] text-sm font-semibold text-white", focusRing, !tel && "col-span-2")}>
            WhatsApp
          </a>
        ) : null}
      </div>
    </>
  );
}
