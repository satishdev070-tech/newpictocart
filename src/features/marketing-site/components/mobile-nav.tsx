"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "./ui";
import { MenuIconView, MENU_TONE_CLASS } from "./chrome-icons";
import type { NavLink } from "../content";
import type { MegaMenu } from "../chrome-content";

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

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {/* The header's backdrop-blur makes it the containing block for this fixed panel, so the panel
          sits at top-full (under the 68/76px header) with an explicit height instead of bottom-0. */}
      <div id={panelId} hidden={!open} className="fixed inset-x-0 top-full z-40 h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-border bg-white sm:h-[calc(100dvh-76px)]">
        <nav aria-label="Main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <ul className="space-y-1">
            {links.map((l) =>
              megaMenu && l.label.trim().toLowerCase() === megaMenu.trigger.trim().toLowerCase() ? (
                <li key={l.href + l.label}>
                  <button
                    type="button"
                    aria-expanded={menuOpen}
                    aria-controls={accordionId}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-brand-md px-3 py-3 text-left text-lg font-semibold text-brand-ink hover:bg-brand-canvas"
                  >
                    {l.label}
                    <ChevronDown aria-hidden className={cn("size-5 text-brand-ink/50 transition-transform duration-200 motion-reduce:transition-none", menuOpen && "rotate-180")} />
                  </button>
                  <div id={accordionId} hidden={!menuOpen} className="mt-1 mb-3 space-y-5 rounded-brand-lg bg-brand-canvas p-4">
                    {megaMenu.columns.map((col) => (
                      <div key={col.title}>
                        <p className={cn("text-[0.7rem] font-bold tracking-[0.14em] uppercase", MENU_TONE_CLASS[col.tone].title)}>{col.title}</p>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {col.items.map((it) => (
                            <li key={it.title + it.href}>
                              <Link href={it.href} prefetch onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
                                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", MENU_TONE_CLASS[col.tone].chip)}>
                                  <MenuIconView name={it.icon} className="size-4" />
                                </span>
                                <span className="text-[0.95rem] font-medium text-brand-ink">{it.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <Link href={l.href} prefetch onClick={() => setOpen(false)} className="block px-2 text-sm font-semibold text-brand">
                      All {l.label.toLowerCase()} →
                    </Link>
                  </div>
                </li>
              ) : (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  prefetch
                  onClick={() => setOpen(false)}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className="block rounded-brand-md px-3 py-3 text-lg font-semibold text-brand-ink hover:bg-brand-canvas aria-[current=page]:text-brand"
                >
                  {l.label}
                </Link>
              </li>
              ),
            )}
          </ul>
          <div className="mt-6 grid gap-3 border-t border-border pt-6">
            <Link href={signupHref} onClick={() => setOpen(false)} className={buttonClass("primary", "lg")}>
              {ctaLabel}
            </Link>
            <a href={loginHref} onClick={() => setOpen(false)} className={buttonClass("secondary", "lg")}>
              {loginLabel}
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}
