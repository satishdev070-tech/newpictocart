/** URL slugs for services and pages (pure). Same rule as the DB check: lowercase, digits, single hyphens, ≤ 120. */

export const INFO_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Paths of the public site that a custom page may not take. */
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([
  "about", "services", "gallery", "contact", "faq", "faqs", "team", "testimonials", "enquiry", "enquiries",
  "privacy", "terms", "sitemap-xml", "robots-txt", "api", "preview", "informative", "admin", "dashboard", "login",
  // Online Store storefront routes (public/paths.ts STORE_ONLY_SEGMENTS): never a custom page address.
  "account", "blog", "cart", "categories", "checkout", "collections", "orders", "pages", "products", "search", "stores", "home",
]);

export function slugify(input: string, max = 120): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s;
}

/** A slug from `base` that is not in `taken`: base, base-2, base-3… (fallback when base is empty). */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, fallback = "item"): string {
  const root = slugify(base) || fallback;
  if (!taken.has(root)) return root;
  for (let i = 2; i < 10_000; i++) {
    const suffix = `-${i}`;
    const candidate = `${root.slice(0, 120 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root.slice(0, 100)}-${Date.now().toString(36)}`;
}
