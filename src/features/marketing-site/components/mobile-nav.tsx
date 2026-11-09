"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "./ui";
import { MenuIconView } from "./chrome-icons";
import type { NavLink } from "../content";
import { normalizeMegaMenuItemHref, type MegaMenu } from "../chrome-content";

/**
 * Mobile menu (below lg). A disclosure button controls a panel: Escape or a link closes it and
 * focus returns to the button; the page behind stops scrolling while it's open. The mega menu
 * trigger (e.g. "Features") becomes an accordion of its columns.
 */
export function MobileNav({
  links,
  loginHref,
  loginLabel = "Login",
  signupHref,
  ctaLabel,
  megaMenu = null,
}: {
  links: NavLink[];
  loginHref: string;
  loginLabel?: string;
  signupHref: string;
  ctaLabel: string;
  megaMenu?: MegaMenu | null;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accordionId = useId();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    document.getElementById(panelId)?.querySelector<HTMLElement>("nav a, nav button")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, panelId]);

  let stagger = 0;

  return (
    <div className="lg:hidden">
      <style>{`
        @keyframes mk-nav-in {
          from { opacity: 0; transform: translateY(0.75rem); }
          to { opacity: 1; transform: none; }
        }
        .mk-nav-stagger {
          opacity: 0;
          animation: mk-nav-in 0.45s var(--ease-mk, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .mk-nav-stagger { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-mk-text hover:bg-mk-elev-2 focus-visible:outline-2 focus-visible:outline-mk-accent"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {/* The header's backdrop-blur makes it the containing block for this fixed panel, so the panel
          sits at top-full (under the 68/76px header) with an explicit height instead of bottom-0. */}
      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-x-0 top-full z-40 h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-mk-line bg-mk-bg sm:h-[calc(100dvh-76px)]"
      >
        {open ? (
          <nav aria-label="Main" className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-8 sm:px-6">
            <ul className="space-y-1">
              {links.map((l) => {
                const delay = `${stagger++ * 55}ms`;
                if (megaMenu && l.label.trim().toLowerCase() === megaMenu.trigger.trim().toLowerCase()) {
                  return (
                    <li key={l.href + l.label} className="mk-nav-stagger" style={{ animationDelay: delay }}>
                      <button
                        type="button"
                        aria-expanded={menuOpen}
                        aria-controls={accordionId}
                        onClick={() => setMenuOpen((v) => !v)}
                        className="flex w-full items-center justify-between rounded-mk-md px-1 py-3 text-left font-mk-display text-3xl font-semibold tracking-tight text-mk-text hover:text-mk-accent sm:text-4xl"
                      >
                        {l.label}
                        <ChevronDown aria-hidden className={cn("size-6 text-mk-muted transition-transform duration-200 motion-reduce:transition-none", menuOpen && "rotate-180")} />
                      </button>
                      <div id={accordionId} hidden={!menuOpen} className="mt-2 mb-4 space-y-5 rounded-mk-lg border border-mk-line bg-mk-elev-1 p-4">
                        {megaMenu.columns.map((col) => (
                          <div key={col.title}>
                            <p className="mk-label text-mk-muted">{col.title}</p>
                            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                              {col.items.map((it) => {
                                const itemHref = normalizeMegaMenuItemHref(it.title, it.href);
                                return (
                                  <li key={it.title + itemHref}>
                                    <Link
                                      href={itemHref}
                                      prefetch
                                      onClick={() => setOpen(false)}
                                      className="group flex items-center gap-3 rounded-mk-sm px-2 py-2 hover:bg-mk-accent-tint/40"
                                    >
                                      <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-mk-elev-2 text-mk-muted ring-1 ring-mk-line transition-colors group-hover:bg-mk-accent-tint group-hover:text-mk-accent group-hover:ring-mk-accent/40">
                                        <MenuIconView name={it.icon} className="size-4" />
                                        <span aria-hidden className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-mk-accent opacity-0 transition-opacity group-hover:opacity-100" />
                                      </span>
                                      <span className="text-[0.95rem] font-medium text-mk-text">{it.title}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                        <Link href={l.href} prefetch onClick={() => setOpen(false)} className="block px-2 text-sm font-semibold text-mk-accent">
                          All {l.label.toLowerCase()} →
                        </Link>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={l.href + l.label} className="mk-nav-stagger" style={{ animationDelay: delay }}>
                    <Link
                      href={l.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      aria-current={pathname === l.href ? "page" : undefined}
                      className="block rounded-mk-md px-1 py-3 font-mk-display text-3xl font-semibold tracking-tight text-mk-text transition-colors hover:text-mk-accent aria-[current=page]:text-mk-accent sm:text-4xl"
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mk-nav-stagger mt-auto grid gap-3 border-t border-mk-line pt-8" style={{ animationDelay: `${stagger * 55}ms` }}>
              <Link
                href={signupHref}
                onClick={() => setOpen(false)}
                className={buttonClass("cta", "lg", "rounded-full border-0")}
              >
                {ctaLabel}
              </Link>
              <a href={loginHref} onClick={() => setOpen(false)} className={buttonClass("secondary", "lg", "rounded-full")}>
                {loginLabel}
              </a>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
