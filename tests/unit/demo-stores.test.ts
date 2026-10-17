import { describe, expect, it } from "vitest";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";
import { findMarketplaceTheme } from "@/features/theme/marketplace/catalog";
import { isShowcaseSlug } from "@/features/theme/marketplace/showcase";
import { demoOwnerEmail, pickThemes, planAll, planStore, retailPrice, validatePlan, type StorePlan } from "../../scripts/demo/generate";
import { DEMO_CATEGORIES } from "../../scripts/demo/data";
import { assertRootFor, assertSafeTarget, isLocalSupabaseUrl, parseArgs } from "../../scripts/demo/guard";
import { nth, photosFor, photoUrl } from "../../scripts/demo/photos";
import { buildThemeConfig, type ThemeRefs } from "../../scripts/demo/theme";

const TENANT = "00000000-0000-4000-a000-0000000000aa";
const uuid = (n: number) => `11111111-1111-4111-a111-${String(n).padStart(12, "0")}`;
function fakeRefs(p: StorePlan): ThemeRefs {
  const path = (s: string) => `tenant/${TENANT}/products/${s}.webp`;
  let n = 0;
  return {
    categoryIds: Object.fromEntries(p.categories.map((c) => [c.slug, uuid(++n)])),
    collectionIds: Object.fromEntries(p.collections.map((c) => [c.slug, uuid(++n)])),
    productIds: p.products.map(() => uuid(++n)),
    fronts: p.products.map((x) => path(x.slug)),
    categoryImages: Object.fromEntries(p.categories.map((c) => [c.slug, path(c.slug)])),
    collectionImages: {},
    images: { hero1: path("h1"), hero2: path("h2"), heroMobile: path("hm"), story: path("s"), feature: path("f"), feature2: path("f2"), promo1: path("p1"), promo2: path("p2") },
  };
}

describe("demo stores: remote-target guard", () => {
  it("recognises local Supabase URLs only", () => {
    for (const u of ["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321", "http://supabase.localhost", "http://db.pictocart.test", "http://host.docker.internal:54321"]) expect(isLocalSupabaseUrl(u), u).toBe(true);
    for (const u of ["https://abcd.supabase.co", "https://localhost.evil.com", "https://127.0.0.1.nip.io", "not a url", "", "ftp://localhost"]) expect(isLocalSupabaseUrl(u), u).toBe(false);
  });

  it("refuses a remote project unless --target=remote AND --yes are both given", () => {
    const remote = "https://ugbjlpdhktrlkyuijkfc.supabase.co";
    expect(() => assertSafeTarget(remote, { target: "local", yes: false, dryRun: false })).toThrow(/Refusing/);
    expect(() => assertSafeTarget(remote, { target: "remote", yes: false, dryRun: false })).toThrow(/Refusing/);
    expect(() => assertSafeTarget(remote, { target: "local", yes: true, dryRun: false })).toThrow(/Refusing/);
    expect(assertSafeTarget(remote, { target: "remote", yes: true, dryRun: false })).toMatch(/^REMOTE/);
    expect(assertSafeTarget(remote, { target: "local", yes: false, dryRun: true })).toMatch(/dry run/);
  });

  it("allows local targets and rejects a contradictory --target=remote", () => {
    expect(assertSafeTarget("http://127.0.0.1:55321", { target: "local", yes: false, dryRun: false })).toBe("local 127.0.0.1:55321");
    expect(() => assertSafeTarget("http://127.0.0.1:55321", { target: "remote", yes: true, dryRun: false })).toThrow(/local database/);
    expect(() => assertSafeTarget("", { target: "local", yes: false, dryRun: false })).toThrow(/not set/);
  });

  it("requires a production root domain for remote runs", () => {
    expect(() => assertRootFor("REMOTE abc.supabase.co", "localhost")).toThrow(/--root/);
    expect(() => assertRootFor("REMOTE abc.supabase.co", "shop.test")).toThrow(/--root/);
    expect(() => assertRootFor("REMOTE abc.supabase.co", "pictocart.in")).not.toThrow();
    expect(() => assertRootFor("REMOTE abc.supabase.co (dry run: nothing is written)", "localhost")).not.toThrow();
    expect(() => assertRootFor("local 127.0.0.1:54321", "localhost")).not.toThrow();
    expect(() => assertRootFor("local 127.0.0.1:54321", "https://x.in/")).toThrow(/invalid root/);
  });

  it("parses options and rejects unknown ones", () => {
    expect(parseArgs(["--dry-run", "--category=beauty", "--slug=nuvi-skin,glam-gully", "--target=remote", "--yes"])).toEqual({ dryRun: true, remove: false, category: "beauty", slugs: ["nuvi-skin", "glam-gully"], target: "remote", yes: true, retheme: false, allowCuratedPhotos: false, refreshPhotos: false, root: null });
    expect(parseArgs(["--root=Pictocart.in"]).root).toBe("pictocart.in");
    expect(parseArgs(["--allow-curated-photos"]).allowCuratedPhotos).toBe(true);
    expect(parseArgs(["--refresh-photos"]).refreshPhotos).toBe(true);
    expect(parseArgs([]).target).toBe("local");
    expect(() => parseArgs(["--target=prod"])).toThrow();
    expect(() => parseArgs(["--force"])).toThrow(/unknown option/);
  });
});

describe("demo stores: generator", () => {
  const plans = planAll();

  it("has data for every store category, two stores each", () => {
    expect(DEMO_CATEGORIES.map((c) => c.industry).sort()).toEqual([...INDUSTRY_SLUGS].sort());
    expect(plans).toHaveLength(INDUSTRY_SLUGS.length * 2);
    for (const slug of INDUSTRY_SLUGS) expect(plans.filter((p) => p.industry === slug), slug).toHaveLength(2);
    expect(planAll("beauty").map((p) => p.slug)).toEqual(["nuvi-skin", "glam-gully"]);
    expect(() => planAll("nope")).toThrow(/unknown category/);
  });

  it("produces valid, unique stores that never collide with showcase stores", () => {
    for (const p of plans) expect(validatePlan(p), p.slug).toEqual([]);
    expect(new Set(plans.map((p) => p.slug)).size).toBe(plans.length);
    expect(plans.filter((p) => isShowcaseSlug(p.slug))).toEqual([]);
    for (const p of plans) {
      expect(p.owner.email).toBe(demoOwnerEmail(p.slug));
      expect(p.owner.email.endsWith(".test")).toBe(true);
    }
  });

  it("keeps money in integer paise with MRP at or above price", () => {
    for (const p of plans)
      for (const pr of p.products)
        for (const v of pr.variants) {
          expect(Number.isSafeInteger(v.price) && v.price > 0).toBe(true);
          if (v.compareAtPrice !== null) expect(v.compareAtPrice).toBeGreaterThanOrEqual(v.price);
        }
    const atta = planStore(DEMO_CATEGORIES.find((c) => c.industry === "grocery")!, 0).products[0]!;
    expect(atta.variants.map((v) => [v.option1, v.price])).toEqual([["1 kg", 6900], ["5 kg", 31900]]);
    expect(retailPrice(18_520)).toBe(18_900);
    expect(retailPrice(149_900)).toBe(149_900);
    expect(retailPrice(4_000)).toBe(4_000);
  });

  it("gives each store 4–6 categories, 12–20 products, collections, reviews, shipping and GST", () => {
    for (const p of plans) {
      expect(p.categories.length).toBeGreaterThanOrEqual(4);
      expect(p.categories.length).toBeLessThanOrEqual(6);
      expect(p.products.length).toBeGreaterThanOrEqual(12);
      expect(p.products.length).toBeLessThanOrEqual(20);
      expect(p.collections.length).toBeGreaterThanOrEqual(3);
      expect(p.reviews.length).toBeGreaterThanOrEqual(3);
      for (const r of p.reviews) expect(p.products[r.product], p.slug).toBeDefined();
      expect(p.shipping.length).toBeGreaterThanOrEqual(2);
      expect(p.taxSettings.rules.length).toBeGreaterThanOrEqual(1);
      expect(p.pages.map((x) => x.slug)).toEqual(expect.arrayContaining(["about", "shipping-policy", "returns", "contact", "privacy"]));
      expect(p.products.every((x) => x.seoTitle && x.seoDescription && x.photo.q)).toBe(true);
    }
  });

  it("the two stores of a category sell different products", () => {
    for (const c of DEMO_CATEGORIES) {
      const [a, b] = [planStore(c, 0), planStore(c, 1)];
      expect(a.products.filter((x) => b.products.some((y) => y.title === x.title)), c.industry).toEqual([]);
    }
  });
});

describe("demo stores: themes", () => {
  it("uses two different themes with different layout variant sets per category", () => {
    for (const c of DEMO_CATEGORIES) {
      const [a, b] = pickThemes(c.industry);
      expect(a.key).not.toBe(b.key);
      const [pa, pb] = [planStore(c, 0), planStore(c, 1)];
      expect(pa.themeKey).toBe(a.key);
      expect(pb.themeKey).toBe(b.key);
      expect(JSON.stringify(pa.layout), c.industry).not.toBe(JSON.stringify(pb.layout));
    }
  });

  it("builds a valid published config with the store's own content", () => {
    for (const p of planAll()) {
      const config = buildThemeConfig(p, fakeRefs(p));
      const hero = config.templates.home.find((s) => s.type === "Hero" && s.visibility.desktop);
      expect(hero, p.slug).toBeDefined();
      expect(JSON.stringify(hero!.settings)).toContain(p.tagline);
      expect(config.tokens.colors.primary).toBe(findMarketplaceTheme(p.themeKey)!.preset.tokens.colors.primary);
      expect(JSON.stringify(config)).not.toMatch(/\$(img|category|collection):/);
    }
  });
});

describe("demo stores: photos", () => {
  it("uses cached search results with credit, else the curated pool", () => {
    const cache = { "wireless earbuds case": [["photo-123-abc", "AbC", "Jane Doe", "janedoe", "Earbuds in a case"] as const] };
    const [hit] = photosFor(cache, "wireless earbuds case", "electronics");
    expect(hit).toMatchObject({ id: "photo-123-abc", source: "search", photographer: { name: "Jane Doe" } });
    expect(hit!.photographer!.url).toContain("unsplash.com/@janedoe");
    const fallback = photosFor({}, "nothing cached", "electronics");
    expect(fallback.length).toBeGreaterThan(1);
    expect(fallback.every((p) => p.source === "curated")).toBe(true);
    expect(nth([1, 2, 3], 7)).toBe(2);
    expect(photoUrl("photo-1", 1200, 1500)).toBe("https://images.unsplash.com/photo-1?auto=format&fit=crop&crop=entropy&q=78&w=1200&h=1500");
  });
});
