"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MegaMenu as MegaMenuContent } from "../chrome-content";
import { MenuIconView, MENU_TONE_CLASS } from "./chrome-icons";

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
          "inline-flex items-center gap-1 rounded-full px-4 py-2 font-medium text-brand-ink/80 transition-colors hover:bg-brand-canvas hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand",
          open && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand",
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
        <div className="mx-auto flex max-h-[calc(100dvh-6rem)] max-w-[1240px] flex-col overflow-hidden rounded-[22px] border border-border bg-white shadow-[0_30px_80px_-24px_rgb(27_29_69/0.35)]">
          <div className="grid min-h-0 grid-cols-3 divide-border overflow-y-auto overscroll-contain xl:grid-cols-6 xl:divide-x">
            {menu.columns.map((col) => {
              const tone = MENU_TONE_CLASS[col.tone];
              return (
                <div key={col.title} className="px-5 py-4 xl:px-4 xl:py-6 2xl:px-5">
                  <p className={cn("text-[0.72rem] font-bold tracking-[0.14em] uppercase", tone.title)}>{col.title}</p>
                  {col.subtitle ? <p className="mt-1 text-[0.8rem] leading-snug text-brand-ink/50">{col.subtitle}</p> : null}
                  <ul className="mt-4 space-y-1">
                    {col.items.map((it) => (
                      <li key={it.title + it.href}>
                        <Link
                          href={it.href}
                          prefetch
                          onClick={() => setOpen(false)}
                          className="group -mx-2 flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-brand-canvas focus-visible:bg-brand-canvas focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ring-1 transition-colors duration-150", tone.chip)}>
                            <MenuIconView name={it.icon} className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[0.88rem] leading-snug font-semibold text-brand-ink">{it.title}</span>
                            {it.body ? <span className="mt-0.5 line-clamp-2 block text-[0.78rem] leading-snug text-brand-ink/55">{it.body}</span> : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {menu.footerLead || menu.footerText || menu.footerLink.label ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-gradient-to-r from-brand-soft via-white to-brand-mint px-6 py-3.5 text-sm">
              <p className="text-brand-ink/70">
                {menu.footerLead ? <strong className="font-semibold text-brand-ink">{menu.footerLead}</strong> : null} {menu.footerText}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <Link href={href} prefetch onClick={() => setOpen(false)} className="font-semibold text-brand-ink/70 hover:text-brand-ink">
                  All {label.toLowerCase()}
                </Link>
                {menu.footerLink.label && menu.footerLink.href ? (
                  <Link href={menu.footerLink.href} prefetch onClick={() => setOpen(false)} className="group inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-hover">
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
