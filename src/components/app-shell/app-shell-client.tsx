"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CornerDownLeft, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavGroup, NavItem } from "@/components/dashboard/nav";
import { NAV_ICONS, NAV_ICON_STROKE } from "./icons";
import { activeGroupFor, activeHrefFor, breadcrumbsFor, flyoutTop, isSubmenu, submenuId, type Crumb } from "./nav-tree";
import { sidebarCookie, type SidebarPanel } from "./sidebar-cookie";

/** Shell chrome labels (the seller panel passes translations; the admin panel uses English). */
export type ShellText = {
  mainNav: string;
  navigation: string;
  openNav: string;
  closeNav: string;
  expandSidebar: string;
  collapseSidebar: string;
  searchPlaceholder: string;
  search: string;
  searchPages: string;
  jumpTo: string;
  breadcrumb: string;
  /** Breadcrumb labels for path segments after a nav item ("new", "edit", ids → "details"...). */
  segments?: Record<string, string>;
};

const EN_TEXT: ShellText = {
  mainNav: "Main",
  navigation: "Navigation",
  openNav: "Open navigation",
  closeNav: "Close navigation",
  expandSidebar: "Expand sidebar",
  collapseSidebar: "Collapse sidebar",
  searchPlaceholder: "Search features, settings, pages…",
  search: "Search",
  searchPages: "Search pages",
  jumpTo: "Jump to…",
  breadcrumb: "Breadcrumb",
};

const TextContext = createContext<ShellText>(EN_TEXT);

type Props = {
  groups: NavGroup[];
  homeHref: string;
  brand: ReactNode;
  brandMark?: ReactNode;
  sidebarFooter: ReactNode;
  topbarStart?: ReactNode;
  topbarEnd: ReactNode;
  banner?: ReactNode;
  storageKey: string;
  panel: SidebarPanel;
  initialCollapsed: boolean;
  text?: ShellText;
  /** `lang` of the panel (the seller's chosen language). */
  lang?: string;
  children: ReactNode;
};

type OnNavigate = (href: string, e: MouseEvent<HTMLAnchorElement>) => void;

/**
 * Highlights the clicked item immediately instead of waiting for the route to commit, so the
 * sidebar answers the click at once even when the next page's data is still streaming. The
 * optimistic href is tied to the pathname it was set on, so it is dropped once the route changes.
 */
function useActiveHref(groups: NavGroup[], homeHref: string) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const active = pending && pending.from === pathname ? pending.href : activeHrefFor(pathname, groups, homeHref);
  const onNavigate = useCallback<OnNavigate>(
    (href, e) => {
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

/** Visible, focusable links and buttons of a nav (skips collapsed submenus, which are inert). */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter((el) => !el.closest("[inert]"));
}

/** ↑/↓/Home/End move between sidebar entries; Tab still works as usual. */
function onArrowKeys(e: ReactKeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = focusables(e.currentTarget);
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

/* ------------------------------------------------------------------ expanded */

type ExpandedNavProps = { groups: NavGroup[]; active: string | null; storageKey: string; onNavigate: OnNavigate; onAfterNavigate?: () => void };

/** Logo + labels + grouped submenus with chevrons (desktop expanded sidebar and the mobile drawer). */
function ExpandedNav({ groups, active, storageKey, onNavigate, onAfterNavigate }: ExpandedNavProps) {
  const router = useRouter();
  const activeGroup = activeGroupFor(active, groups);
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
  const text = useContext(TextContext);
  const row = (item: NavItem, nested = false) => (
    <NavRow
      key={item.href}
      item={item}
      nested={nested}
      active={item.href === active}
      onClick={(e) => {
        onNavigate(item.href, e);
        onAfterNavigate?.();
      }}
    />
  );

  return (
    <nav aria-label={text.mainNav} onKeyDown={onArrowKeys}>
      <ul className="space-y-1">
        {groups.map((g) => {
          if (!isSubmenu(g)) return row(g.items[0]!);
          const expanded = isOpen(g.label);
          const Icon = NAV_ICONS[g.icon ?? g.items[0]!.icon];
          const id = submenuId(storageKey, g.id ?? g.label);
          const hasActive = g.label === activeGroup;
          return (
            <li key={g.label}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={id}
                onClick={() => toggle(g.label)}
                onKeyDown={(e) => {
                  if ((e.key === "ArrowRight" && !expanded) || (e.key === "ArrowLeft" && expanded)) {
                    e.preventDefault();
                    toggle(g.label);
                  }
                }}
                onPointerEnter={() => warm(g)}
                onFocus={() => warm(g)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-body font-medium transition-colors",
                  hasActive ? "text-foreground" : "text-foreground/85",
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

function NavRow({ item, active, nested, onClick }: { item: NavItem; active: boolean; nested: boolean; onClick: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 transition-colors",
          nested ? "h-9 pl-10 text-small" : "h-10 text-body font-medium",
          active ? "bg-accent-soft font-medium text-accent" : nested ? "text-muted hover:bg-surface-secondary hover:text-foreground" : "text-foreground/85 hover:bg-surface-secondary hover:text-foreground",
        )}
      >
        {nested ? (
          <span aria-hidden className={cn("absolute left-[1.3rem] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full", active ? "bg-accent-strong" : "bg-border")} />
        ) : (
          <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted")} />
        )}
        <span className="min-w-0 truncate">{item.label}</span>
        <PendingHint />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ collapsed rail */

/**
 * Tooltip and flyout for the icon rail. Both are position:fixed so the rail can scroll
 * (overflow) without clipping them; their place is taken from the trigger's rectangle.
 */
type Floating = { label: string; top: number; left: number };

function useRailTip() {
  const [tip, setTip] = useState<Floating | null>(null);
  const show = (label: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hide = () => setTip(null);
  const bind = (label: string) => ({
    onPointerEnter: (e: { currentTarget: HTMLElement }) => show(label, e.currentTarget),
    onPointerLeave: hide,
    onFocus: (e: { currentTarget: HTMLElement }) => show(label, e.currentTarget),
    onBlur: hide,
  });
  const node = tip ? (
    <span role="tooltip" style={{ top: tip.top, left: tip.left }} className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-caption font-medium text-background shadow-md">
      {tip.label}
    </span>
  ) : null;
  return { bind, hide, node };
}

type RailNavProps = { groups: NavGroup[]; active: string | null; storageKey: string; onNavigate: OnNavigate; tip: ReturnType<typeof useRailTip> };

/** Icon rail: one icon per section; sections with children open a flyout submenu on hover or click. */
function RailNav({ groups, active, storageKey, onNavigate, tip }: RailNavProps) {
  const text = useContext(TextContext);
  const router = useRouter();
  const pathname = usePathname();
  const activeGroup = activeGroupFor(active, groups);
  const [flyout, setFlyout] = useState<(Floating & { pinned: boolean }) | null>(null);
  const [top, setTop] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setFlyout((f) => (f?.pinned ? f : null)), 160);
  };
  const openFor = useCallback((g: NavGroup, pinned: boolean) => {
    const el = triggers.current.get(g.label);
    if (!el) return;
    const r = el.getBoundingClientRect();
    g.items.forEach((i) => router.prefetch(i.href));
    setFlyout({ label: g.label, top: r.top, left: r.right + 10, pinned });
  }, [router]);
  const close = useCallback((focusTrigger = false) => {
    setFlyout((f) => {
      if (f && focusTrigger) triggers.current.get(f.label)?.focus();
      return null;
    });
  }, []);

  // Keep the flyout inside the viewport once its height is known.
  useLayoutEffect(() => {
    if (!flyout || !panel.current) return;
    setTop(flyoutTop(flyout.top, panel.current.offsetHeight, window.innerHeight));
  }, [flyout]);

  // Close on route change, outside pointer, resize and rail scroll (the rail is sticky, so page
  // scrolling leaves the trigger, and the flyout, where they are).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigation finished: drop the open flyout
    setFlyout(null);
  }, [pathname]);
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || triggers.current.get(flyout.label)?.contains(t)) return;
      setFlyout(null);
    };
    const onClose = () => setFlyout(null);
    const scroller = navRef.current?.parentElement;
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onClose);
    scroller?.addEventListener("scroll", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onClose);
      scroller?.removeEventListener("scroll", onClose);
    };
  }, [flyout]);
  useEffect(() => cancelClose, []);

  const openGroup = flyout ? groups.find((g) => g.label === flyout.label) : undefined;
  const iconClass = (on: boolean) =>
    cn("relative grid size-11 place-items-center rounded-xl transition-colors", on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-secondary hover:text-foreground");

  return (
    <nav ref={navRef} aria-label={text.mainNav} onKeyDown={onArrowKeys}>
      <ul className="flex flex-col items-center gap-1">
        {groups.map((g) => {
          const Icon = NAV_ICONS[g.icon ?? g.items[0]!.icon];
          const on = g.label === activeGroup;
          if (!isSubmenu(g)) {
            const item = g.items[0]!;
            return (
              <li key={g.label}>
                <Link href={item.href} aria-current={item.href === active ? "page" : undefined} onClick={(e) => onNavigate(item.href, e)} className={iconClass(on)} {...tip.bind(item.label)}>
                  <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className="size-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </li>
            );
          }
          const expanded = flyout?.label === g.label;
          const id = submenuId(`${storageKey}-rail`, g.id ?? g.label);
          return (
            <li key={g.label}>
              <button
                ref={(el) => {
                  if (el) triggers.current.set(g.label, el);
                  else triggers.current.delete(g.label);
                }}
                type="button"
                aria-haspopup="menu"
                aria-expanded={expanded}
                aria-controls={expanded ? id : undefined}
                onPointerEnter={(e) => {
                  if (e.pointerType === "touch") return;
                  cancelClose();
                  tip.hide();
                  if (!flyout?.pinned || flyout.label !== g.label) openFor(g, false);
                }}
                onPointerLeave={scheduleClose}
                onClick={() => {
                  tip.hide();
                  if (expanded && flyout?.pinned) close();
                  else openFor(g, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || ((e.key === "Enter" || e.key === " ") && !expanded)) {
                    e.preventDefault();
                    openFor(g, true);
                    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("a[href]")?.focus());
                  } else if (e.key === "Escape" && expanded) {
                    e.preventDefault();
                    close(true);
                  }
                }}
                className={cn(iconClass(on), expanded && !on && "bg-surface-secondary text-foreground")}
              >
                <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className="size-5" />
                <span aria-hidden className="absolute bottom-1.5 right-1.5 size-1 rounded-full bg-current opacity-50" />
                <span className="sr-only">{g.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {flyout && openGroup ? (
        <div
          ref={panel}
          id={submenuId(`${storageKey}-rail`, openGroup.id ?? openGroup.label)}
          role="menu"
          aria-label={openGroup.label}
          style={{ top: top || flyout.top, left: flyout.left }}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onKeyDown={(e) => {
            const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("a[href]"));
            const i = links.indexOf(document.activeElement as HTMLElement);
            if (e.key === "Escape" || e.key === "ArrowLeft") {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              links[(i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
            } else if (e.key === "Tab") {
              close();
            }
          }}
          className="fixed z-[60] w-60 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg animate-[shell-in_150ms_ease-out]"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-overline text-subtle">{openGroup.label}</p>
          <ul className="space-y-0.5">
            {openGroup.items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const isActive = item.href === active;
              return (
                <li key={item.href} role="none">
                  <Link
                    role="menuitem"
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => {
                      onNavigate(item.href, e);
                      close();
                    }}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-small transition-colors",
                      isActive ? "bg-accent-soft font-medium text-accent" : "text-foreground/85 hover:bg-surface-secondary hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden strokeWidth={NAV_ICON_STROKE} className={cn("size-4 shrink-0", isActive ? "text-accent" : "text-muted")} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <PendingHint />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

/* ------------------------------------------------------------------ topbar */

/** ⌘K / Ctrl+K quick jump to any module the member can access. */
function CommandSearch({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const text = useContext(TextContext);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const items = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), [groups]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => i.label.toLowerCase().includes(t) || i.alt?.toLowerCase().includes(t) || i.group.toLowerCase().includes(t)) : items;
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
        data-tour="search"
        className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-surface-secondary/70 px-3 text-small text-subtle transition-colors hover:border-border-strong hover:bg-surface md:flex"
      >
        <Search aria-hidden className="size-4" strokeWidth={NAV_ICON_STROKE} />
        <span className="flex-1 truncate text-left">{text.searchPlaceholder}</span>
        <kbd className="rounded border border-border bg-surface px-1.5 text-caption text-muted">⌘K</kbd>
      </button>
      <button type="button" onClick={open} aria-label={text.search} data-tour="search" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-secondary md:hidden">
        <Search aria-hidden className="size-4" strokeWidth={NAV_ICON_STROKE} />
      </button>
      <dialog
        ref={dialog}
        aria-label={text.search}
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
            placeholder={text.jumpTo}
            aria-label={text.searchPages}
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

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const text = useContext(TextContext);
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label={text.breadcrumb} className="mb-4">
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

/* ------------------------------------------------------------------ shell */

export function AppShellClient({ groups, homeHref, brand, brandMark, sidebarFooter, topbarStart, topbarEnd, banner, storageKey, panel, initialCollapsed, text = EN_TEXT, lang, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const drawer = useRef<HTMLDialogElement>(null);
  const crumbs = useMemo(() => breadcrumbsFor(pathname, groups, homeHref, text.segments), [pathname, groups, homeHref, text.segments]);
  const { active, onNavigate } = useActiveHref(groups, homeHref);
  const tip = useRailTip();

  useEffect(() => {
    drawer.current?.close();
  }, [pathname]);
  const toggle = () => {
    const next = !collapsed;
    tip.hide();
    setCollapsed(next);
    document.cookie = sidebarCookie(panel, next);
  };
  const toggleLabel = collapsed ? text.expandSidebar : text.collapseSidebar;

  return (
    <TextContext value={text}>
    <div lang={lang} className="theme-panel flex min-h-dvh flex-1 bg-background">
      <aside
        data-collapsed={collapsed || undefined}
        data-tour="nav"
        className={cn("sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out lg:flex", collapsed ? "w-[76px]" : "w-64")}
      >
        <div className={cn("flex shrink-0", collapsed ? "flex-col items-center gap-2 px-2 pb-1 pt-3" : "h-16 items-center gap-2 pl-4 pr-3")}>
          {collapsed ? (brandMark ?? null) : <div className="min-w-0 flex-1 overflow-hidden">{brand}</div>}
          {/* The toggle sits at the top in both states, so it is always on screen. */}
          <div className="group/toggle relative shrink-0">
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              {...(collapsed ? tip.bind(toggleLabel) : {})}
              className={cn("grid place-items-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground", collapsed ? "size-11 rounded-xl" : "size-9")}
            >
              {collapsed ? <PanelLeftOpen aria-hidden className="size-5" strokeWidth={NAV_ICON_STROKE} /> : <PanelLeftClose aria-hidden className="size-[18px]" strokeWidth={NAV_ICON_STROKE} />}
            </button>
            {collapsed ? null : (
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-caption font-medium text-background shadow-md group-focus-within/toggle:block group-hover/toggle:block"
              >
                {toggleLabel}
              </span>
            )}
          </div>
        </div>
        {collapsed ? <div aria-hidden className="mx-4 mt-2 shrink-0 border-t border-border" /> : null}

        {/* min-h-0 lets the nav scroll inside the sidebar instead of pushing the footer off screen. */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3", collapsed ? "px-2 [scrollbar-width:none]" : "px-3 [scrollbar-gutter:stable]")}>
          {collapsed ? (
            <RailNav groups={groups} active={active} storageKey={storageKey} onNavigate={onNavigate} tip={tip} />
          ) : (
            <ExpandedNav groups={groups} active={active} storageKey={storageKey} onNavigate={onNavigate} />
          )}
        </div>

        {collapsed ? null : <div className="shrink-0 space-y-0.5 border-t border-border p-3">{sidebarFooter}</div>}
        {tip.node}
      </aside>

      <dialog
        ref={drawer}
        aria-label={text.navigation}
        className="theme-panel m-0 h-dvh max-h-none w-[min(86vw,300px)] max-w-none border-0 border-r border-border bg-surface p-0 text-foreground backdrop:bg-black/40 open:animate-[shell-in_200ms_ease-out]"
        onClick={(e) => e.target === drawer.current && drawer.current?.close()}
      >
        {/* .theme-panel paints the page background on the dialog itself; the drawer is a surface. */}
        <div className="flex h-full flex-col bg-surface">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="min-w-0 flex-1 overflow-hidden">{brand}</div>
            <button type="button" onClick={() => drawer.current?.close()} aria-label={text.closeNav} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-secondary">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <ExpandedNav groups={groups} active={active} storageKey={storageKey} onNavigate={onNavigate} onAfterNavigate={() => drawer.current?.close()} />
          </div>
          <div className="shrink-0 space-y-0.5 border-t border-border p-3">{sidebarFooter}</div>
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:gap-3 sm:px-6">
          <button type="button" onClick={() => drawer.current?.showModal()} aria-label={text.openNav} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-secondary lg:hidden">
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
    </TextContext>
  );
}
