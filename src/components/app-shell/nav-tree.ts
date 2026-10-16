import type { NavGroup } from "@/components/dashboard/nav";

/** Pure navigation helpers shared by the sidebar, the breadcrumbs and their tests. */

/** The console root ("/dashboard", "/admin") is active only on itself; other items also match their sub-pages. */
export function navItemMatches(pathname: string, href: string, homeHref: string): boolean {
  return href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The single nav item for a path: the longest matching href ("/dashboard/settings/team" beats "/dashboard/settings"). */
export function activeHrefFor(pathname: string, groups: readonly NavGroup[], homeHref: string): string | null {
  let best: string | null = null;
  for (const g of groups) for (const i of g.items) if (navItemMatches(pathname, i.href, homeHref) && (!best || i.href.length > best.length)) best = i.href;
  return best;
}

/** Label of the group holding the active item (that submenu opens on its own). */
export function activeGroupFor(active: string | null, groups: readonly NavGroup[]): string | null {
  if (!active) return null;
  return groups.find((g) => g.items.some((i) => i.href === active))?.label ?? null;
}

/** A group with one item renders as a plain link; with more it is a submenu. */
export function isSubmenu(group: NavGroup): boolean {
  return group.items.length > 1;
}

/** Stable DOM id for a group's submenu. */
export function submenuId(scope: string, label: string): string {
  return `nav-${scope}-${label.replace(/\W+/g, "-").toLowerCase()}`;
}

/** Collapsed-flyout top edge: aligned with its trigger, kept inside the viewport with a margin. */
export function flyoutTop(triggerTop: number, flyoutHeight: number, viewportHeight: number, margin = 8): number {
  return Math.max(margin, Math.min(triggerTop, viewportHeight - flyoutHeight - margin));
}

const SEGMENT_LABELS: Record<string, string> = { new: "New", edit: "Edit", import: "Import", export: "Export", support: "Support" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Crumb = { label: string; href?: string };

/** Group › Item › sub-page crumbs for a path (empty when no item matches). */
export function breadcrumbsFor(pathname: string, groups: readonly NavGroup[], homeHref: string): Crumb[] {
  const href = activeHrefFor(pathname, groups, homeHref);
  const group = groups.find((g) => g.items.some((i) => i.href === href));
  const match = group?.items.find((i) => i.href === href);
  if (!group || !match) return [];
  const crumbs: Crumb[] = [];
  if (match.href !== homeHref && match.label !== group.label) crumbs.push({ label: group.label });
  crumbs.push({ label: match.label, href: pathname === match.href ? undefined : match.href });
  const rest = pathname.slice(match.href.length).split("/").filter(Boolean);
  rest.forEach((seg, i) => {
    const label = SEGMENT_LABELS[seg] ?? (UUID.test(seg) ? "Details" : seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
    crumbs.push({ label, href: i === rest.length - 1 ? undefined : `${match.href}/${rest.slice(0, i + 1).join("/")}` });
  });
  return crumbs;
}
