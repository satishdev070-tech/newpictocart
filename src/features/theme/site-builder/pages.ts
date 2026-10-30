import type { ThemeConfig } from "@/features/theme/schema/config";
import { builderGroupVisible, type SiteMode } from "@/features/stores/site-mode";
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
  /** Content page shown in this row too (the store's Contact content page is merged into the built-in Contact row). */
  contentPageId?: string;
  /** Another storefront path that opens this row (in-canvas navigation). */
  altPath?: string;
};

export type PageSources = {
  /** Content pages from the database (Content → Pages). */
  contentPages: { id: string; title: string; slug: string; kind?: string }[];
  /** A product and a collection to show the product / product-list templates with real data. */
  sampleProductSlug: string | null;
  sampleCollectionSlug: string | null;
  blog: boolean;
};

export function builderPages(config: ThemeConfig, src: PageSources, siteMode?: SiteMode): BuilderPage[] {
  // A site-builder page set as the homepage is edited as the Home row ("/"), not as its own row.
  const homePage = config.homePageId ? config.pages.find((p) => p.id === config.homePageId) : undefined;
  const out: BuilderPage[] = [
    homePage
      ? { key: "home", label: homePage.title, group: "pages", path: paths.home(), list: `pages.${homePage.id}`, themePageId: homePage.id }
      : { key: "home", label: "Home", group: "pages", path: paths.home(), list: "templates.home" },
  ];
  for (const p of config.pages) if (p !== homePage) out.push({ key: `theme:${p.id}`, label: p.title, group: "pages", path: paths.page(p.handle), list: `pages.${p.id}`, themePageId: p.id });
  // New stores get a "Contact" content page (/pages/contact) besides the built-in /contact, which
  // already shows that page's text with the contact form. List them as one Contact row.
  const contactPage = contactContentPage(src.contentPages);
  for (const p of src.contentPages) {
    if (p === contactPage) continue;
    out.push({ key: `content:${p.id}`, label: p.title, group: "pages", path: paths.page(p.slug), list: "templates.page", settingsHref: `/dashboard/content/pages/${p.id}` });
  }
  const t = config.builtinTitles;
  out.push(
    contactPage
      ? { key: "contact", label: t.contact || contactPage.title || "Contact", group: "pages", path: paths.contact(), list: "templates.page", settingsHref: `/dashboard/content/pages/${contactPage.id}`, contentPageId: contactPage.id, altPath: paths.page(contactPage.slug) }
      : { key: "contact", label: t.contact || "Contact", group: "pages", path: paths.contact(), list: "templates.page", settingsHref: "/dashboard/settings" },
  );
  out.push({ key: "faq", label: t.faq || "FAQ", group: "pages", path: paths.faq(), list: "templates.page", settingsHref: "/dashboard/content/faqs" });
  if (src.blog) out.push({ key: "blog", label: t.blog || "Blog", group: "pages", path: paths.blog(), list: "templates.blog", settingsHref: "/dashboard/content/blog" });

  // Product list only when we have a real collection sample — otherwise it duplicates Collections (/collections + collectionList).
  if (src.sampleCollectionSlug) {
    out.push({ key: "product-list", label: "Product list", group: "ecommerce", path: paths.collection(src.sampleCollectionSlug), list: "templates.collection", settingsHref: "/dashboard/collections" });
  }
  if (src.sampleProductSlug) out.push({ key: "product", label: "Product details", group: "ecommerce", path: paths.product(src.sampleProductSlug), list: "templates.product", settingsHref: "/dashboard/products" });
  out.push({ key: "search", label: "Search", group: "ecommerce", path: paths.search(), list: "templates.search" });
  out.push({ key: "collections", label: "Collections", group: "ecommerce", path: paths.collections(), list: "templates.collectionList", settingsHref: "/dashboard/collections" });
  out.push({ key: "cart", label: "Cart", group: "ecommerce", path: paths.cart(), list: "templates.cart" });

  out.push({ key: "login", label: "Login", group: "members", path: "/account/login", list: "templates.account" });
  out.push({ key: "signup", label: "Sign up", group: "members", path: "/account/register", list: "templates.account" });
  out.push({ key: "account", label: "My account", group: "members", path: paths.account(), list: "templates.account" });
  out.push({ key: "reset-password", label: "Reset password", group: "members", path: "/account/forgot-password", list: "templates.account" });

  for (const p of config.popups) out.push({ key: `popup:${p.id}`, label: p.name, group: "popups", path: paths.home(), list: null, popupId: p.id });
  return withDistinctLabels(out.filter((page) => builderGroupVisible(page.group, siteMode)));
}

/** The content page merged into the built-in Contact row: slug "contact", else the first page of kind "contact". */
export function contactContentPage<T extends { slug: string; kind?: string }>(pages: T[]): T | undefined {
  return pages.find((p) => p.slug === "contact") ?? pages.find((p) => p.kind === "contact");
}

/** Pages that would show the same name get their address added, so the list never shows two identical rows. */
function withDistinctLabels(pages: BuilderPage[]): BuilderPage[] {
  const seen = new Map<string, number>();
  for (const p of pages) if (p.group === "pages") seen.set(p.label.trim().toLowerCase(), (seen.get(p.label.trim().toLowerCase()) ?? 0) + 1);
  return pages.map((p) => (p.group === "pages" && p.key !== "home" && (seen.get(p.label.trim().toLowerCase()) ?? 0) > 1 ? { ...p, label: `${p.label} (${p.path})` } : p));
}

/** The registry page for a canvas path (after in-canvas navigation), or null. */
export function pageForPath(pages: BuilderPage[], path: string): BuilderPage | null {
  const clean = path.split("?")[0]!.split("#")[0]!.replace(/\/$/, "") || "/";
  const exact = pages.find((p) => p.group !== "popups" && (p.path === clean || p.altPath === clean));
  if (exact) return exact;
  if (clean.startsWith("/products/")) return pages.find((p) => p.key === "product") ?? null;
  if (clean.startsWith("/collections/") || clean.startsWith("/categories/")) return pages.find((p) => p.key === "product-list") ?? null;
  if (clean.startsWith("/blog")) return pages.find((p) => p.key === "blog") ?? null;
  if (clean.startsWith("/account")) return pages.find((p) => p.key === "account") ?? null;
  return null;
}
