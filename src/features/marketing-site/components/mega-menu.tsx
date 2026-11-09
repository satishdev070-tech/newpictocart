"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { normalizeMegaMenuItemHref, type MegaMenu as MegaMenuContent } from "../chrome-content";
import { MenuIconView } from "./chrome-icons";

/**
 * Desktop "Features ▾" mega menu. A disclosure: opens on hover, focus or click; Escape, a link,
 * leaving it or tabbing out closes it. The panel is positioned against the sticky <header>.
 */
export function MegaMenu({ label, href, menu }: { label: string; href: string; menu: MegaMenuContent }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hover/focus open the menu just before a click lands; that click shouldn't close it again.
  const openedAt = useRef(0);
  const pathname = usePathname();

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen((o) => {
      if (!o) openedAt.current = Date.now();
      return true;
    });
  };
  const hide = (delay = 0) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), []);
  // Close after navigating (the header stays mounted across pages).
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      onMouseEnter={show}
      onMouseLeave={() => hide(140)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) hide();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={show}
        onClick={() => {
          if (open && Date.now() - openedAt.current < 400) return;
          if (open) setOpen(false);
          else show();
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-4 py-2 font-medium text-mk-muted transition-colors hover:bg-mk-elev-2 hover:text-mk-text focus-visible:outline-2 focus-visible:outline-mk-accent",
          open && "bg-mk-elev-2 text-mk-text",
        )}
      >
        {label}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      <div
        id={panelId}
        className={cn(
          "absolute inset-x-0 top-full px-4 pt-2 transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none sm:px-6",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto flex max-h-[calc(100dvh-6rem)] max-w-[1240px] flex-col overflow-hidden rounded-mk-lg border border-mk-line bg-mk-elev-1 shadow-brand-float">
          <div className="grid min-h-0 grid-cols-3 divide-mk-line overflow-y-auto overscroll-contain xl:grid-cols-6 xl:divide-x">
            {menu.columns.map((col) => (
              <div key={col.title} className="px-5 py-4 xl:px-4 xl:py-6 2xl:px-5">
                <p className="mk-label text-mk-muted">{col.title}</p>
                {col.subtitle ? <p className="mt-1 text-[0.8rem] leading-snug text-mk-dim">{col.subtitle}</p> : null}
                <ul className="mt-4 space-y-1">
                  {col.items.map((it) => {
                    const itemHref = normalizeMegaMenuItemHref(it.title, it.href);
                    return (
                      <li key={it.title + itemHref}>
                        <Link
                          href={itemHref}
                          prefetch
                          onClick={() => setOpen(false)}
                          className="group -mx-2 flex gap-3 rounded-mk-sm px-2 py-2 transition-colors hover:bg-mk-accent-tint/40 focus-visible:bg-mk-accent-tint/40 focus-visible:outline-2 focus-visible:outline-mk-accent"
                        >
                          <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-mk-elev-2 text-mk-muted ring-1 ring-mk-line transition-colors duration-150 group-hover:bg-mk-accent-tint group-hover:text-mk-accent group-hover:ring-mk-accent/40">
                            <MenuIconView name={it.icon} className="size-4" />
                            <span
                              aria-hidden
                              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-mk-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[0.88rem] leading-snug font-semibold text-mk-text">{it.title}</span>
                            {it.body ? <span className="mt-0.5 line-clamp-2 block text-[0.78rem] leading-snug text-mk-muted">{it.body}</span> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {menu.footerLead || menu.footerText || menu.footerLink.label ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-mk-line bg-mk-elev-2/60 px-6 py-3.5 text-sm">
              <p className="text-mk-muted">
                {menu.footerLead ? <strong className="font-semibold text-mk-text">{menu.footerLead}</strong> : null} {menu.footerText}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <Link href={href} prefetch onClick={() => setOpen(false)} className="font-semibold text-mk-muted hover:text-mk-text">
                  All {label.toLowerCase()}
                </Link>
                {menu.footerLink.label && menu.footerLink.href ? (
                  <Link href={menu.footerLink.href} prefetch onClick={() => setOpen(false)} className="group inline-flex items-center gap-1 font-semibold text-mk-accent hover:text-mk-accent-hover">
                    {menu.footerLink.label}
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
