import { createElement, type ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

/**
 * Render smoke test: EVERY section type in EVERY design (layout variant) server-renders without
 * throwing, with mocked catalog/content data (no database). Catches broken variant branches that
 * type checks can't (bad array access, missing data guards, invalid element nesting errors).
 */

const card = (i: number) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  slug: `product-${i}`,
  title: `Product ${i}`,
  brand: "Brand",
  productType: "other",
  imagePath: null,
  imageAlt: "",
  hoverImagePath: null,
  priceMinor: 129900 + i * 1000,
  compareAtMinor: i % 2 ? 159900 : null,
  hasPriceRange: false,
  inStock: true,
  isNew: i === 1,
  isBestseller: i === 2,
  ratingAvg: 4.5,
  ratingCount: 3,
  singleVariantId: null,
  sizes: [],
});
const cards = [1, 2, 3, 4, 5, 6].map(card);

vi.mock("@/features/storefront/server/catalog", async (orig) => ({
  ...(await orig<object>()),
  listProducts: vi.fn(async () => ({ cards, total: cards.length })),
  listProductIds: vi.fn(async () => ({ ids: cards.map((c) => c.id), total: cards.length })),
  getProductCards: vi.fn(async () => cards),
  getCollections: vi.fn(async () => [1, 2, 3, 4].map((i) => ({ id: `c${i}`, title: `Collection ${i}`, slug: `collection-${i}`, description: "Desc", imagePath: null, seo: {}, updatedAt: "2026-01-01" }))),
  getAllCategories: vi.fn(async () => [1, 2, 3, 4, 5].map((i) => ({ id: `k${i}`, name: `Category ${i}`, slug: `category-${i}`, parentId: null, description: "Desc", imagePath: null, seo: {}, updatedAt: "2026-01-01" }))),
  getProductBySlug: vi.fn(async () => null),
  getProductRefs: vi.fn(async () => new Map()),
}));
vi.mock("@/features/storefront/server/content", async (orig) => ({
  ...(await orig<object>()),
  getFaqs: vi.fn(async () => [1, 2, 3].map((i) => ({ id: `f${i}`, question: `Question ${i}?`, answer: `Answer ${i}`, group: "General" }))),
  getBlogPostById: vi.fn(async () => null),
  getLatestReviews: vi.fn(async () => [1, 2, 3].map((i) => ({ id: `r${i}`, rating: 5, title: "Great", body: "Lovely product", authorName: `Buyer ${i}`, verified: true, sample: false, createdAt: "2026-01-01" }))),
  getPageById: vi.fn(async () => null),
  getReviewSummary: vi.fn(async () => ({ average: 4.6, count: 12 })),
  listBlogPosts: vi.fn(async () => ({ posts: [1, 2, 3].map((i) => ({ id: `b${i}`, title: `Post ${i}`, slug: `post-${i}`, excerpt: "Excerpt", coverPath: null, authorName: "Team", tags: [], publishedAt: "2026-01-01", updatedAt: "2026-01-01" })), total: 3 })),
}));
// Client islands call Next's router hooks; outside a mounted app router they need a stand-in.
vi.mock("next/navigation", async (orig) => ({
  ...(await orig<object>()),
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// The header's cart drawer reads the cart cookie (request scope only); not under test here.
vi.mock("@/features/cart/components/cart-drawer-content", () => ({ CartDrawerContent: () => null }));
vi.mock("@/features/social/server/instagram-feed", async (orig) => ({ ...(await orig<object>()), getInstagramFeed: vi.fn(async () => null) }));
vi.mock("@/features/storefront/server/logo", async (orig) => ({ ...(await orig<object>()), getStoreLogo: vi.fn(async () => null) }));

const { SECTION_DEFINITIONS, defaultSettings } = await import("@/features/theme/sections/definitions");
const { SectionList } = await import("@/features/theme/render/sections");
const { DEFAULT_THEME_CONFIG } = await import("@/features/theme/default-theme");

const ctx = {
  sf: {
    tenant: { tenantId: "11111111-1111-4111-8111-111111111111", slug: "demo", name: "Demo", status: "active", host: "demo.localhost", primaryHost: "demo.localhost" },
    store: {
      name: "Demo Store",
      tagline: "Tagline",
      description: "Description",
      logoPath: null,
      faviconPath: null,
      email: "hello@example.com",
      phone: "+919876543210",
      whatsapp: "+919876543210",
      address: { line1: "MG Road", city: "Kochi", state: "Kerala", postalCode: "682001", country: "IN" },
      social: [{ network: "instagram", url: "https://instagram.com/demo" }],
      seo: {},
      cod: {},
    },
    theme: DEFAULT_THEME_CONFIG,
    preview: false,
    themePreview: null,
    features: { blog: true, storeLocator: false, reviews: true, cod: true },
  },
  menus: { main: { title: "Main", items: [{ id: "m1", title: "Shop", href: "/collections", external: false, highlight: false, imagePath: null, children: [] }] } },
  cartCount: 0,
  signedIn: false,
  stock: null,
  stockProducts: false,
} as never;

async function render(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node, { onError: (e) => { throw e; } });
  let html = "";
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

type Field = { kind: string; key: string; display?: string; options?: { value: string }[] };
const cases: [string, Record<string, unknown>][] = [];
for (const [type, def] of Object.entries(SECTION_DEFINITIONS) as [keyof typeof SECTION_DEFINITIONS, { fields: Field[] }][]) {
  const variantFields = def.fields.filter((f) => f.kind === "select" && f.display === "variants");
  if (!variantFields.length) cases.push([`${type} (default)`, { type }]);
  for (const f of variantFields) for (const o of f.options ?? []) cases.push([`${type} ${f.key}=${o.value}`, { type, [f.key]: o.value }]);
}

describe("every section design renders", () => {
  it("has a case for every section type", () => {
    expect(new Set(cases.map(([, c]) => c.type)).size).toBe(Object.keys(SECTION_DEFINITIONS).length);
  });

  it.each(cases)("%s", async (_name, c) => {
    const { type, ...variant } = c as { type: keyof typeof SECTION_DEFINITIONS } & Record<string, unknown>;
    const section = { id: "smoke-1", type, settings: { ...defaultSettings(type), ...variant }, visibility: { desktop: true, mobile: true } };
    const html = await render(createElement(SectionList, { sections: [section], ctx }));
    expect(html.length).toBeGreaterThan(0);
  });
});
