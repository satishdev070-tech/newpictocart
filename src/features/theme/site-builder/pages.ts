import type { ThemeConfig } from "@/features/theme/schema/config";
import { paths } from "@/features/storefront/urls";
import type { ListKey } from "./slots";

/**
 * The builder's page registry (pure): every page the "Pages:" dropdown and the Pages panel list,
 * where the canvas loads it, and which section lists it shows (header + template/page + footer).
 */

export type PageGroup = "pages" | "ecommerce" | "members" | "popups";
export const PAGE_GROUP_LABELS: Record<PageGroup, string> = { pages: "Pages", ecommerce: "eCommerce", members: "Members area", popups: "Popups" };

export type BuilderPage = {
  /** Stable key: "home", "product", "theme:<pageId>", "content:<uuid>", "popup:<id>" … */
  key: string;
  label: string;
  group: PageGroup;
  /** Storefront path loaded in the canvas. */
  path: string;
  /** The page's own section list (editable in Layers / "+"), besides header and footer. */
  list: ListKey | null;
  /** Theme page id (site-builder page) when key is theme:<id>. */
  themePageId?: string;
  popupId?: string;
  /** Where its settings live when they are not in the theme (dashboard path). */
  settingsHref?: string;
};

export type PageSources = {
  /** Content pages from the database (Content → Pages). */
  contentPages: { id: string; title: string; slug: string }[];
  /** A product and a collection to show the product / product-list templates with real data. */
  sampleProductSlug: string | null;
  sampleCollectionSlug: string | null;
  blog: boolean;
};

export function builderPages(config: ThemeConfig, src: PageSources): BuilderPage[] {
  const out: BuilderPage[] = [{ key: "home", label: "Home", group: "pages", path: paths.home(), list: "templates.home" }];
  for (const p of config.pages) out.push({ key: `theme:${p.id}`, label: p.title, group: "pages", path: paths.page(p.handle), list: `pages.${p.id}`, themePageId: p.id });
  for (const p of src.contentPages) out.push({ key: `content:${p.id}`, label: p.title, group: "pages", path: paths.page(p.slug), list: "templates.page", settingsHref: `/dashboard/content/pages/${p.id}` });
  out.push({ key: "contact", label: "Contact", group: "pages", path: paths.contact(), list: "templates.page", settingsHref: "/dashboard/settings" });
  out.push({ key: "faq", label: "FAQ", group: "pages", path: paths.faq(), list: "templates.page", settingsHref: "/dashboard/content/faqs" });
  if (src.blog) out.push({ key: "blog", label: "Blog", group: "pages", path: paths.blog(), list: "templates.blog", settingsHref: "/dashboard/content/blog" });

  out.push({ key: "product-list", label: "Product list", group: "ecommerce", path: src.sampleCollectionSlug ? paths.collection(src.sampleCollectionSlug) : paths.collections(), list: src.sampleCollectionSlug ? "templates.collection" : "templates.collectionList", settingsHref: "/dashboard/collections" });
  if (src.sampleProductSlug) out.push({ key: "product", label: "Product details", group: "ecommerce", path: paths.product(src.sampleProductSlug), list: "templates.product", settingsHref: "/dashboard/products" });
  out.push({ key: "search", label: "Search", group: "ecommerce", path: paths.search(), list: "templates.search" });
  out.push({ key: "collections", label: "Collections", group: "ecommerce", path: paths.collections(), list: "templates.collectionList", settingsHref: "/dashboard/collections" });
  out.push({ key: "cart", label: "Cart", group: "ecommerce", path: paths.cart(), list: "templates.cart" });

  out.push({ key: "login", label: "Login", group: "members", path: "/account/login", list: "templates.account" });
  out.push({ key: "signup", label: "Sign up", group: "members", path: "/account/register", list: "templates.account" });
  out.push({ key: "account", label: "My account", group: "members", path: paths.account(), list: "templates.account" });
  out.push({ key: "reset-password", label: "Reset password", group: "members", path: "/account/forgot-password", list: "templates.account" });

  for (const p of config.popups) out.push({ key: `popup:${p.id}`, label: p.name, group: "popups", path: paths.home(), list: null, popupId: p.id });
  return out;
}

/** The registry page for a canvas path (after in-canvas navigation), or null. */
export function pageForPath(pages: BuilderPage[], path: string): BuilderPage | null {
  const clean = path.split("?")[0]!.split("#")[0]!.replace(/\/$/, "") || "/";
  const exact = pages.find((p) => p.group !== "popups" && p.path === clean);
  if (exact) return exact;
  if (clean.startsWith("/products/")) return pages.find((p) => p.key === "product") ?? null;
  if (clean.startsWith("/collections/") || clean.startsWith("/categories/")) return pages.find((p) => p.key === "product-list") ?? null;
  if (clean.startsWith("/blog")) return pages.find((p) => p.key === "blog") ?? null;
  if (clean.startsWith("/account")) return pages.find((p) => p.key === "account") ?? null;
  return null;
}
