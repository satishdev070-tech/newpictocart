"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft, Menu as MenuIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavGroup, NavItem } from "@/components/dashboard/nav";
import { NAV_ICONS, NAV_ICON_STROKE } from "./icons";

type Props = {
  groups: NavGroup[];
  /** Root of this console ("/dashboard" or "/admin"): only active on itself. */
  homeHref: string;
  brand: ReactNode;
  /** Square mark shown in the collapsed (icon-only) sidebar. */
  brandMark?: ReactNode;
  sidebarFooter: ReactNode;
  /** Shown at the start of the topbar after the menu button (e.g. an "Admin mode" label). */
  topbarStart?: ReactNode;
  topbarEnd: ReactNode;
  banner?: ReactNode;
  storageKey: string;
  children: ReactNode;
};

function matches(pathname: string, href: string, homeHref: string) {
  return href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The single nav item for a path: the longest matching href ("/dashboard/settings/team" beats "/dashboard/settings"). */
function activeHrefFor(pathname: string, groups: NavGroup[], homeHref: string): string | null {
  let best: string | null = null;
  for (const g of groups) for (const i of g.items) if (matches(pathname, i.href, homeHref) && (!best || i.href.length > best.length)) best = i.href;
  return best;
}

const SEGMENT_LABELS: Record<string, string> = { new: "New", edit: "Edit", import: "Import", export: "Export", support: "Support" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useBreadcrumbs(pathname: string, groups: NavGroup[], homeHref: string) {
  return useMemo(() => {
    const flat = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
    const href = activeHrefFor(pathname, groups, homeHref);
    const match = flat.find((i) => i.href === href);
    if (!match) return [] as { label: string; href?: string }[];
    const crumbs: { label: string; href?: string }[] = [];
    if (match.href !== homeHref && match.label !== match.group) crumbs.push({ label: match.group });
    crumbs.push({ label: match.label, href: pathname === match.href ? undefined : match.href });
    const rest = pathname.slice(match.href.length).split("/").filter(Boolean);
    rest.forEach((seg, i) => {
      const label = SEGMENT_LABELS[seg] ?? (UUID.test(seg) ? "Details" : seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
      crumbs.push({ label, href: i === rest.length - 1 ? undefined : `${match.href}/${rest.slice(0, i + 1).join("/")}` });
    });
    return crumbs;
  }, [pathname, groups, homeHref]);
}

/**
 * Highlights the clicked item immediately instead of waiting for the route to commit, so the
 * sidebar answers the click at once even when the next page's data is still streaming. The
 * optimistic href is tied to the pathname it was set on, so it is dropped once the route changes.
 */
function useActiveHref(groups: NavGroup[], homeHref: string) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const active = pending && pending.from === pathname ? pending.href : activeHrefFor(pathname, groups, homeHref);
  const onNavigate = useCallback(
    (href: string, e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      setPending({ href, from: pathname });
    },
    [pathname],
  );
  return { active, onNavigate };
}

/** Fixed-size dot inside a nav link that pulses while that navigation is pending (no layout shift). */
function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cn("ml-auto size-1.5 shrink-0 rounded-full bg-accent-strong transition-opacity", pending ? "animate-pulse opacity-100" : "opacity-0")} />;
}

type NavListProps = { groups: NavGroup[]; collapsed: boolean; active: string | null; storageKey: string; onNavigate: (href: string, e: MouseEvent<HTMLAnchorElement>) => void; onAfterNavigate?: () => void };

function NavList({ groups, collapsed, active, storageKey, onNavigate, onAfterNavigate }: NavListProps) {
  const router = useRouter();
  const activeGroup = groups.find((g) => g.items.some((i) => i.href === active))?.label;
  // The active page's submenu is always open (unless closed while on it); other submenus follow
  // the member's saved choice once mounted, so server and first client render agree.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [closedActive, setClosedActive] = useState<{ label: string; path: string | null } | null>(null);
  const key = `${storageKey}:groups`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, boolean>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      setOpen(saved && typeof saved === "object" ? saved : {});
    } catch {
      /* storage unavailable or malformed */
    }
  }, [key]);
  const isOpen = (label: string) => (label === activeGroup ? !(closedActive?.label === label && closedActive.path === active) : !!open[label]);
  const toggle = (label: string) => {
    if (label === activeGroup) return setClosedActive(isOpen(label) ? { label, path: active } : null);
    setOpen((o) => {
      const next = { ...o, [label]: !o[label] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };
  // Warm the router cache for a submenu's pages as soon as the pointer or focus reaches it.
  const warm = (g: NavGroup) => g.items.forEach((i) => router.prefetch(i.href));
  const row = (item: NavItem, nested = false) => (
    <NavRow
      key={item.href}
      item={item}
      nested={nested}
      active={item.href === active}
      collapsed={collapsed}
      onClick={(e) => {
        onNavigate(item.href, e);
        onAfterNavigate?.();
      }}
    />
  );

  if (collapsed) {
    return (
      <nav aria-label="Main" className="space-y-3">
        {groups.map((g, i) => (
          <div key={g.label}>
            {i ? <div aria-hidden className="mx-3 mb-3 border-t border-border" /> : null}
            <p className="sr-only">{g.label}</p>
            <ul className="space-y-0.5">{g.items.map((item) => row(item))}</ul>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {groups.map((g) => {
          if (g.items.length === 1) return row(g.items[0]!);
          const expanded = isOpen(g.label);
          const Icon = NAV_ICONS[g.icon ?? g.items[0]!.icon];
          const id = `nav-${storageKey}-${g.label.replace(/\W+/g, "-").toLowerCase()}`;
          const hasActive = g.label === activeGroup;
          return (
            <li key={g.label}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={id}
                onClick={() => toggle(g.label)}
                onPointerEnter={() => warm(g)}
                onFocus={() => warm(g)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-body font-medium transition-colors",
                  hasActive && !expanded ? "text-accent" : "text-foreground/85",
                  "hover:bg-surface-secondary hover:text-foreground",
                )}
              >
                <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className={cn("size-[18px] shrink-0", hasActive ? "text-accent" : "text-muted")} />
                <span className="flex-1 truncate">{g.label}</span>
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-subtle transition-transform duration-200", expanded && "rotate-180")} />
              </button>
              {/* grid-rows 0fr→1fr animates to the content's own height: no measuring, no jank. */}
              <div id={id} inert={!expanded} className={cn("grid transition-[grid-template-rows] duration-200 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <ul className="min-h-0 space-y-0.5 overflow-hidden">
                  <li aria-hidden className="h-0.5" />
                  {g.items.map((item) => row(item, true))}
                  <li aria-hidden className="h-1" />
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavRow({ item, active, collapsed, nested, onClick }: { item: NavItem; active: boolean; collapsed: boolean; nested: boolean; onClick: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <li className="group/nav relative">
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 transition-colors",
          nested ? "h-9 pl-10 text-small" : "h-10 text-body font-medium",
          collapsed && "h-9 justify-center px-0",
          active ? "bg-accent-soft font-medium text-accent" : nested ? "text-muted hover:bg-surface-secondary hover:text-foreground" : "text-foreground/85 hover:bg-surface-secondary hover:text-foreground",
        )}
      >
        {nested && !collapsed ? (
          <span aria-hidden className={cn("absolute left-[1.3rem] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full", active ? "bg-accent-strong" : "bg-border")} />
        ) : (
          <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted")} />
        )}
        <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
        {collapsed ? null : <PendingHint />}
      </Link>
      {collapsed ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-caption font-medium text-background shadow-md group-focus-within/nav:block group-hover/nav:block"
        >
          {item.label}
        </span>
      ) : null}
    </li>
  );
}

/** ⌘K / Ctrl+K quick jump to any module the member can access. */
function CommandSearch({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const items = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => i.label.toLowerCase().includes(t) || i.group.toLowerCase().includes(t)) : items;
  }, [q, items]);
  const open = useCallback(() => {
    setQ("");
    setCursor(0);
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const go = (href: string) => {
    dialog.current?.close();
    router.push(href);
  };
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-surface-secondary/70 px-3 text-small text-subtle transition-colors hover:border-border-strong hover:bg-surface md:flex"
      >
        <Search aria-hidden className="size-4" strokeWidth={NAV_ICON_STROKE} />
        <span className="flex-1 truncate text-left">Search features, settings, pages…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 text-caption text-muted">⌘K</kbd>
      </button>
      <button type="button" onClick={open} aria-label="Search" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-secondary md:hidden">
        <Search aria-hidden className="size-4" strokeWidth={NAV_ICON_STROKE} />
      </button>
      <dialog
        ref={dialog}
        aria-label="Search"
        className="m-auto mt-[12vh] w-[min(92vw,560px)] overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search aria-hidden className="size-4 text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor].href);
              }
            }}
            placeholder="Jump to…"
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-results"
            aria-activedescendant={results[cursor] ? `cmd-${results[cursor].href}` : undefined}
            className="h-12 flex-1 bg-transparent text-body outline-none placeholder:text-subtle"
          />
          <kbd className="rounded border border-border px-1.5 text-caption text-muted">Esc</kbd>
        </div>
        <ul id="cmd-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length ? (
            results.map((r, i) => {
              const Icon = NAV_ICONS[r.icon];
              return (
                <li key={r.href} id={`cmd-${r.href}`} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r.href)}
                    className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-small", i === cursor ? "bg-accent-soft text-accent" : "")}
                  >
                    <Icon aria-hidden className="size-4 opacity-80" strokeWidth={NAV_ICON_STROKE} />
                    <span className="flex-1">{r.label}</span>
                    <span className="text-caption text-subtle">{r.group}</span>
                    {i === cursor ? <CornerDownLeft aria-hidden className="size-3.5 text-subtle" /> : null}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-6 text-center text-small text-muted">No matches for “{q}”</li>
          )}
        </ul>
      </dialog>
    </>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex min-w-0 items-center gap-1.5 text-small">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className={cn("flex min-w-0 items-center gap-1.5", i < crumbs.length - 2 && "hidden sm:flex")}>
            {i > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-subtle" /> : null}
            {c.href ? (
              <Link href={c.href} className="truncate text-muted hover:text-accent">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted")}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AppShell({ groups, homeHref, brand, brandMark, sidebarFooter, topbarStart, topbarEnd, banner, storageKey, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const crumbs = useBreadcrumbs(pathname, groups, homeHref);
  const { active, onNavigate } = useActiveHref(groups, homeHref);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      setCollapsed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);
  useEffect(() => {
    drawer.current?.close();
  }, [pathname]);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(storageKey, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });

  return (
    <div className="theme-panel flex min-h-dvh flex-1 bg-background">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center px-2" : "px-4")}>{collapsed ? (brandMark ?? null) : <div className="min-w-0 flex-1">{brand}</div>}</div>
        <div className={cn("flex-1 py-3", collapsed ? "overflow-visible px-3" : "overflow-y-auto px-3 [scrollbar-gutter:stable]")}>
          <NavList groups={groups} collapsed={collapsed} active={active} storageKey={storageKey} onNavigate={onNavigate} />
        </div>
        <div className="shrink-0 space-y-0.5 border-t border-border p-3">
          {collapsed ? null : sidebarFooter}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-small text-muted transition-colors hover:bg-surface-secondary hover:text-foreground", collapsed && "justify-center px-0")}
          >
            <ChevronLeft aria-hidden className={cn("size-[18px] shrink-0 transition-transform duration-200", collapsed && "rotate-180")} strokeWidth={NAV_ICON_STROKE} />
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <dialog
        ref={drawer}
        aria-label="Navigation"
        className="theme-panel m-0 h-dvh max-h-none w-[min(86vw,300px)] max-w-none border-0 border-r border-border bg-surface p-0 text-foreground backdrop:bg-black/40 open:animate-[shell-in_200ms_ease-out]"
        onClick={(e) => e.target === drawer.current && drawer.current?.close()}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
            <div className="min-w-0 flex-1">{brand}</div>
            <button type="button" onClick={() => drawer.current?.close()} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-secondary">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NavList groups={groups} collapsed={false} active={active} storageKey={storageKey} onNavigate={onNavigate} onAfterNavigate={() => drawer.current?.close()} />
          </div>
          <div className="space-y-0.5 border-t border-border p-3">{sidebarFooter}</div>
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:gap-3 sm:px-6">
          <button type="button" onClick={() => drawer.current?.showModal()} aria-label="Open navigation" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-secondary lg:hidden">
            <MenuIcon aria-hidden className="size-5" strokeWidth={NAV_ICON_STROKE} />
          </button>
          {brandMark ? <div className="shrink-0 lg:hidden">{brandMark}</div> : null}
          {topbarStart}
          <div className="flex min-w-0 flex-1 items-center">
            <CommandSearch groups={groups} />
          </div>
          <div className="flex items-center gap-1">{topbarEnd}</div>
        </header>
        {banner}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 has-[[data-full-width]]:max-w-none">
          <Breadcrumbs crumbs={crumbs} />
          {children}
        </main>
      </div>
    </div>
  );
}
