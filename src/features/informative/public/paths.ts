import { INFO_SLUG_RE } from "../slug";

/**
 * Public Informative Website routes (pure, unit tested): /, /about, /services, /services/:slug,
 * /gallery, /contact, /:customPageSlug. Every other storefront path is store-only and 404s for an
 * Informative Website (the "store routes wrapped" rule, applied once in the storefront layout).
 */
export type InformativeRoute =
  | { kind: "home" }
  | { kind: "about" }
  | { kind: "services" }
  | { kind: "service"; slug: string }
  | { kind: "gallery" }
  | { kind: "contact" }
  | { kind: "custom"; slug: string };

/** First path segments owned by the Online Store storefront (src/app/store/[host]/*). Kept in sync by a test. */
export const STORE_ONLY_SEGMENTS: ReadonlySet<string> = new Set([
  "account", "blog", "cart", "categories", "checkout", "collections", "faq", "orders", "pages", "preview", "products", "search", "stores",
]);

export function informativeRoute(pathname: string | null | undefined): InformativeRoute | null {
  const path = (pathname ?? "/").split("?")[0]!.replace(/\/+$/, "") || "/";
  if (path === "/") return { kind: "home" };
  const parts = path.slice(1).split("/").map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return "\u0000";
    }
  });
  const [first, second, ...rest] = parts;
  if (!first || rest.length) return null;
  if (second !== undefined) return first === "services" && INFO_SLUG_RE.test(second) && second.length <= 120 ? { kind: "service", slug: second } : null;
  if (first === "about" || first === "services" || first === "gallery" || first === "contact") return { kind: first };
  if (STORE_ONLY_SEGMENTS.has(first) || !INFO_SLUG_RE.test(first) || first.length > 120) return null;
  return { kind: "custom", slug: first };
}

export function routePath(r: InformativeRoute): string {
  switch (r.kind) {
    case "home":
      return "/";
    case "service":
      return `/services/${r.slug}`;
    case "custom":
      return `/${r.slug}`;
    default:
      return `/${r.kind}`;
  }
}
