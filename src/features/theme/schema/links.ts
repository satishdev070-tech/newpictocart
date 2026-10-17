import { z } from "zod";
import { paths, safeMenuUrl, type LinkTargets, type MenuNode } from "@/features/storefront/urls";
import { SECTION_ID_RE, isSafeHref, plainText } from "./primitives";

/**
 * Site builder menus and links (pure; shared by the builder, the renderer and tests).
 *
 * A theme can carry its own copy of a menu (by handle). When it does, the storefront renders that
 * copy instead of the database menu with the same handle, so menu edits made in the builder follow
 * the theme's draft → publish flow. Links reference entities by id (like menu_items); the renderer
 * resolves ids to slugs in one batched lookup per type.
 */

export const LINK_TYPES = ["none", "home", "page", "product", "collection", "blogPost", "blogCategory", "url", "popup"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  none: "None",
  home: "Home",
  page: "Pages",
  product: "Products",
  collection: "Collections",
  blogPost: "Blog posts",
  blogCategory: "Blog category",
  url: "Web address",
  popup: "Popup",
};

/** Built-in storefront pages a "Pages" link can point at (ref `builtin:<key>`). */
export const BUILTIN_PAGES = {
  contact: { label: "Contact", path: paths.contact() },
  faq: { label: "FAQ", path: paths.faq() },
  blog: { label: "Blog", path: paths.blog() },
  collections: { label: "All collections", path: paths.collections() },
  search: { label: "Search", path: paths.search() },
  cart: { label: "Cart", path: paths.cart() },
  account: { label: "My account", path: paths.account() },
  stores: { label: "Store locations", path: paths.stores() },
} as const;
export type BuiltinPage = keyof typeof BUILTIN_PAGES;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAGE_HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const ANCHOR_RE = /^[A-Za-z0-9_-]{0,64}$/;
const TAG_RE = /^[^\u0000-\u001f<>]{1,40}$/;

/** True when `ref` is well-formed for the link type (existence is checked at render). */
export function isValidLinkRef(type: LinkType, ref: string): boolean {
  switch (type) {
    case "none":
    case "home":
    case "url":
      return true;
    case "page":
      if (ref.startsWith("theme:")) return PAGE_HANDLE_RE.test(ref.slice(6));
      if (ref.startsWith("builtin:")) return ref.slice(8) in BUILTIN_PAGES;
      return UUID_RE.test(ref);
    case "product":
    case "collection":
      return UUID_RE.test(ref);
    case "blogPost":
      return ref === "" || UUID_RE.test(ref);
    case "blogCategory":
      return TAG_RE.test(ref);
    case "popup":
      return SECTION_ID_RE.test(ref);
  }
}

export const themeLinkSchema = z
  .object({
    type: z.enum(LINK_TYPES).default("none"),
    ref: z.string().trim().max(120).default(""),
    url: z.string().trim().max(500).default(""),
    /** Section on the target page to scroll to (a section id → #s-<id>, or a free anchor). */
    anchor: z.string().trim().regex(ANCHOR_RE, "Use letters, numbers, - or _").default(""),
    newTab: z.boolean().default(false),
  })
  .superRefine((l, ctx) => {
    if (l.type === "url" && !(l.url && isSafeHref(l.url))) ctx.addIssue({ code: "custom", path: ["url"], message: "Use a link starting with / or https://" });
    if (!isValidLinkRef(l.type, l.ref)) ctx.addIssue({ code: "custom", path: ["ref"], message: "Pick what this link opens" });
  });
export type ThemeLink = z.infer<typeof themeLinkSchema>;

export const MAX_MENU_ITEMS = 40;
const childItem = z.object({
  id: z.string().regex(SECTION_ID_RE),
  title: plainText(60).pipe(z.string().min(1, "Give the menu item a name")),
  link: themeLinkSchema.prefault({}),
  highlight: z.boolean().default(false),
});
export const themeMenuItemSchema = childItem.extend({ children: z.array(childItem).max(20).default([]) });
export type ThemeMenuItem = z.infer<typeof themeMenuItemSchema>;

export const themeMenuSchema = z.object({
  title: plainText(60).default("Menu"),
  items: z.array(themeMenuItemSchema).max(MAX_MENU_ITEMS).default([]),
});
export type ThemeMenu = z.infer<typeof themeMenuSchema>;

export const MENU_HANDLE_RE = /^[a-z0-9-]{2,40}$/;
export const themeMenusSchema = z
  .record(z.string().regex(MENU_HANDLE_RE), themeMenuSchema)
  .refine((r) => Object.keys(r).length <= 8, "At most 8 menus")
  .default({});

/** What a link needs to resolve: id → slug maps plus the theme's own pages and popups. */
export type ThemeLinkTargets = LinkTargets & { themePages: ReadonlySet<string>; popups: ReadonlySet<string> };

export const EMPTY_LINK_TARGETS: ThemeLinkTargets = {
  collections: new Map(),
  categories: new Map(),
  products: new Map(),
  pages: new Map(),
  blogPosts: new Map(),
  themePages: new Set(),
  popups: new Set(),
};

const withAnchor = (href: string, anchor: string) => (anchor ? `${href.split("#")[0]}#${anchor}` : href);

/**
 * Link → href. Null when the link opens nothing (type none, or the target no longer exists).
 * External = opens in a new tab (the renderer adds rel="noopener noreferrer").
 */
export function resolveThemeLink(link: ThemeLink, t: ThemeLinkTargets): { href: string; external: boolean } | null {
  const internal = (href: string) => ({ href: withAnchor(href, link.anchor), external: link.newTab });
  const slug = (m: ReadonlyMap<string, string>, build: (s: string) => string) => {
    const s = m.get(link.ref);
    return s ? internal(build(s)) : null;
  };
  switch (link.type) {
    case "none":
      return link.anchor ? internal(`#${link.anchor}`) : null;
    case "home":
      return internal(paths.home());
    case "page": {
      if (link.ref.startsWith("theme:")) {
        const handle = link.ref.slice(6);
        return t.themePages.has(handle) ? internal(paths.page(handle)) : null;
      }
      if (link.ref.startsWith("builtin:")) {
        const b = BUILTIN_PAGES[link.ref.slice(8) as BuiltinPage];
        return b ? internal(b.path) : null;
      }
      return slug(t.pages, paths.page);
    }
    case "product":
      return slug(t.products, paths.product);
    case "collection":
      return slug(t.collections, paths.collection);
    case "blogPost":
      return link.ref ? slug(t.blogPosts, paths.blogPost) : internal(paths.blog());
    case "blogCategory":
      return internal(`${paths.blog()}?tag=${encodeURIComponent(link.ref)}`);
    case "url": {
      const u = safeMenuUrl(link.url);
      if (!u) return null;
      return { href: u.external ? u.href : withAnchor(u.href, link.anchor), external: u.external || link.newTab };
    }
    case "popup":
      return t.popups.has(link.ref) ? { href: `#popup-${link.ref}`, external: false } : null;
  }
}

/** Theme menu → the MenuNode tree the header/footer renderers already understand. */
export function themeMenuToNodes(menu: ThemeMenu, t: ThemeLinkTargets): MenuNode[] {
  const node = (it: { id: string; title: string; link: ThemeLink; highlight: boolean }, children: MenuNode[]): MenuNode => {
    const r = resolveThemeLink(it.link, t);
    return { id: it.id, title: it.title, href: r?.href ?? null, external: r?.external ?? false, highlight: it.highlight, imagePath: null, children };
  };
  return menu.items.map((it) => node(it, it.children.map((c) => node(c, []))));
}

/** Entity ids referenced by theme menus, grouped for one batched slug lookup per type. */
export function themeMenuRefs(menus: Record<string, ThemeMenu>): { collection: string[]; product: string[]; page: string[]; blog: string[] } {
  const out = { collection: new Set<string>(), product: new Set<string>(), page: new Set<string>(), blog: new Set<string>() };
  const visit = (l: ThemeLink) => {
    if (l.type === "collection") out.collection.add(l.ref);
    else if (l.type === "product") out.product.add(l.ref);
    else if (l.type === "page" && UUID_RE.test(l.ref)) out.page.add(l.ref);
    else if (l.type === "blogPost" && l.ref) out.blog.add(l.ref);
  };
  for (const m of Object.values(menus)) for (const it of m.items) {
    visit(it.link);
    for (const c of it.children) visit(c.link);
  }
  return { collection: [...out.collection], product: [...out.product], page: [...out.page], blog: [...out.blog] };
}

/** Legacy menu_items row → theme link (the builder copies a database menu into the theme on first edit). */
export function linkFromMenuRow(row: { link_type: string; link_ref: string | null; url: string | null }): ThemeLink {
  const base = { ref: "", url: "", anchor: "", newTab: false };
  switch (row.link_type) {
    case "home":
      return { ...base, type: "home" };
    case "search":
      return { ...base, type: "page", ref: "builtin:search" };
    case "collection":
    case "product":
      return row.link_ref ? { ...base, type: row.link_type, ref: row.link_ref } : { ...base, type: "none" };
    case "page":
      return row.link_ref ? { ...base, type: "page", ref: row.link_ref } : { ...base, type: "none" };
    case "blog":
      return { ...base, type: "blogPost", ref: row.link_ref ?? "" };
    case "url": {
      const u = safeMenuUrl(row.url);
      return u ? { ...base, type: "url", url: u.href, newTab: u.external } : { ...base, type: "none" };
    }
    default:
      // Categories have no builder link type yet: keep them as a web address to the same page.
      return { ...base, type: "none" };
  }
}
