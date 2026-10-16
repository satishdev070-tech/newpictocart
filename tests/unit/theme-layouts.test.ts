import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { parseThemeConfigStrict, resolveThemeConfig } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import {
  CATEGORY_VARIANTS,
  FOOTER_LAYOUTS,
  HEADER_STYLES,
  HERO_VARIANTS,
  NEWSLETTER_VARIANTS,
  PRODUCT_GRID_VARIANTS,
  STORY_VARIANTS,
  TESTIMONIAL_VARIANTS,
  USP_VARIANTS,
} from "@/features/theme/sections/variants";
import { LAYOUT_PERSONALITIES, layoutFamily, signatureComposition } from "@/features/theme/layouts/personalities";
import { layoutSummary, withLayout } from "@/features/theme/layouts/apply-layout";
import { themeUnsplashImages } from "@/features/theme/layouts/imagery";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { applyThemePreset } from "@/features/theme/marketplace/apply";
import type { ThemePreset } from "@/features/theme/marketplace/types";
import type { EditorField } from "@/features/theme/sections/types";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";
import { UNSPLASH_CATEGORIES } from "@/lib/unsplash-categories";
import { STOCK_SLOTS, curatedStock, curatedStockSet, pickStock, stockCredits, stockIndex } from "@/lib/unsplash-stock";
import imageLoader from "@/lib/images/loader";

/** A home page saved before layout variants existed (no variant / layout / style keys anywhere). */
const LEGACY = {
  schemaVersion: 1,
  tokens: { colors: { primary: "#222222" }, headingFont: "didone" },
  layout: {
    header: [{ id: "header-1", type: "Header", settings: { layout: "logo-left" } }],
    footer: [{ id: "footer-1", type: "Footer", settings: { tone: "muted" } }],
  },
  templates: {
    home: [
      { id: "hero-1", type: "Hero", settings: { height: "full", overlay: 30 } },
      { id: "grid-1", type: "ProductGrid", settings: { source: "newest", columns: 3 } },
      { id: "cats-1", type: "CategoryGrid", settings: { shape: "circle" } },
      { id: "story-1", type: "BrandStory", settings: { heading: "Our story" } },
      { id: "quotes-1", type: "Testimonials", settings: { items: [{ quote: "Lovely", author: "Asha" }] } },
      { id: "news-1", type: "Newsletter", settings: { tone: "dark" } },
      { id: "trust-1", type: "TrustBadges", settings: { layout: "marquee" } },
      { id: "best-1", type: "Bestseller", settings: { layout: "grid" } },
    ],
  },
};

const settingsOf = (cfg: { templates: { home: { type: string; settings: Record<string, unknown> }[] } }, type: string) => cfg.templates.home.find((s) => s.type === type)!.settings;

describe("layout variants: schema and back-compat", () => {
  it("renders legacy documents with the original layouts (first variant is the default)", () => {
    const strict = parseThemeConfigStrict(LEGACY);
    expect(strict.ok).toBe(true);
    const { config, issues } = resolveThemeConfig(LEGACY);
    expect(issues).toEqual([]);
    expect(config.templates.home).toHaveLength(8);
    expect(settingsOf(config, "Hero")).toMatchObject({ variant: "overlay", height: "full", mediaRatio: "auto", panelTone: "muted" });
    expect(settingsOf(config, "ProductGrid")).toMatchObject({ variant: "grid", columns: 3, cardRatio: "theme", spacing: "default" });
    expect(settingsOf(config, "CategoryGrid")).toMatchObject({ variant: "grid", shape: "circle" });
    expect(settingsOf(config, "BrandStory")).toMatchObject({ variant: "split", imagePosition: "right", tone: "light" });
    expect(settingsOf(config, "Testimonials")).toMatchObject({ variant: "grid" });
    expect(settingsOf(config, "Newsletter")).toMatchObject({ variant: "centered", tone: "dark" });
    expect(settingsOf(config, "TrustBadges")).toMatchObject({ layout: "marquee" });
    expect(settingsOf(config, "Bestseller")).toMatchObject({ layout: "grid" });
    expect(config.layout.header[0]!.settings).toMatchObject({ layout: "logo-left", style: "classic" });
    expect(config.layout.footer[0]!.settings).toMatchObject({ layout: "columns", tone: "muted" });
    expect(config.tokens.imagery).toBe("auto");
  });

  it("keeps the default theme valid and unchanged in look", () => {
    const { config, issues } = resolveThemeConfig(DEFAULT_THEME_CONFIG);
    expect(issues).toEqual([]);
    const hero = config.templates.home.find((s) => s.type === "Hero");
    if (hero) expect(hero.settings.variant).toBe("overlay");
  });

  it("accepts every declared variant value", () => {
    const cases: [string, string, readonly { value: string }[]][] = [
      ["Hero", "variant", HERO_VARIANTS],
      ["ProductGrid", "variant", PRODUCT_GRID_VARIANTS],
      ["CategoryGrid", "variant", CATEGORY_VARIANTS],
      ["BrandStory", "variant", STORY_VARIANTS],
      ["Testimonials", "variant", TESTIMONIAL_VARIANTS],
      ["Newsletter", "variant", NEWSLETTER_VARIANTS],
      ["TrustBadges", "layout", USP_VARIANTS],
      ["Header", "style", HEADER_STYLES],
      ["Footer", "layout", FOOTER_LAYOUTS],
    ];
    for (const [type, key, list] of cases) {
      const schema = SECTION_DEFINITIONS[type as keyof typeof SECTION_DEFINITIONS].schema;
      expect(defaultSettings(type as never)[key], type).toBe(list[0]!.value);
      for (const { value } of list) expect(schema.safeParse({ [key]: value }).success, `${type}.${key}=${value}`).toBe(true);
      expect(schema.safeParse({ [key]: "nope" }).success, `${type} rejects unknown`).toBe(false);
    }
    for (const layout of ["carousel", ...PRODUCT_GRID_VARIANTS.map((o) => o.value)]) expect(SECTION_DEFINITIONS.NewArrivals.schema.safeParse({ layout }).success).toBe(true);
    expect(SECTION_DEFINITIONS.EditorialImageText.schema.safeParse({ variant: "overlap" }).success).toBe(true);
    expect(SECTION_DEFINITIONS.CollectionGrid.schema.safeParse({ layout: "mosaic" }).success).toBe(true);
    expect(SECTION_DEFINITIONS.CollectionGrid.schema.safeParse({ layout: "pills" }).success).toBe(false);
  });

  it("rejects an unknown variant on save and skips only that section on render", () => {
    const bad = structuredClone(LEGACY);
    (bad.templates.home[0]!.settings as Record<string, unknown>).variant = "<script>";
    const strict = parseThemeConfigStrict(bad);
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.issues[0]!.path).toBe("templates.home.0.settings.variant");
    const { config } = resolveThemeConfig(bad);
    expect(config.templates.home.map((s) => s.type)).not.toContain("Hero");
    expect(config.templates.home).toHaveLength(7);
  });

  it("exposes every variant field to the editor as a variant picker", () => {
    const pickers = Object.values(SECTION_DEFINITIONS).flatMap((d) => (d.fields as EditorField[]).filter((f) => f.kind === "select" && f.display === "variants").map((f) => `${d.type}.${f.key}`));
    expect(pickers).toEqual(expect.arrayContaining(["Hero.variant", "ProductGrid.variant", "CategoryGrid.variant", "CollectionGrid.layout", "BrandStory.variant", "Testimonials.variant", "Newsletter.variant", "TrustBadges.layout", "Header.style", "Footer.layout", "EditorialImageText.variant", "Bestseller.layout"]));
    for (const d of Object.values(SECTION_DEFINITIONS)) {
      const shape = (d.schema as unknown as { shape: Record<string, unknown> }).shape;
      for (const f of d.fields) expect(Object.hasOwn(shape, f.key), `${d.type}.${f.key} has a schema key`).toBe(true);
    }
  });
});

describe("layout personalities", () => {
  it("covers every photo category with usable lists and a valid signature page", () => {
    expect(Object.keys(LAYOUT_PERSONALITIES).sort()).toEqual([...UNSPLASH_CATEGORIES].sort());
    for (const p of Object.values(LAYOUT_PERSONALITIES)) {
      for (const key of ["hero", "heroPanel", "products", "categories", "collections", "story", "editorial", "testimonials", "newsletter", "usp", "header", "footer", "spacing"] as const) expect(p[key].length, `${p.family}.${key}`).toBeGreaterThan(0);
      const preset = { ...MARKETPLACE_THEMES[0]!.preset, home: signatureComposition(p.family) } as ThemePreset;
      const strict = parseThemeConfigStrict(applyThemePreset(DEFAULT_THEME_CONFIG, preset));
      expect(strict.ok ? [] : strict.issues, p.family).toEqual([]);
    }
  });

  it("maps every store industry to a layout family", () => {
    for (const slug of INDUSTRY_SLUGS) expect(UNSPLASH_CATEGORIES).toContain(layoutFamily(slug));
    expect(layoutFamily("gourmet")).toBe("food");
    expect(layoutFamily("home-decor")).toBe("furniture");
  });

  it("gives categories different signature pages", () => {
    const sigs = Object.values(LAYOUT_PERSONALITIES).map((p) => JSON.stringify(p.signature));
    expect(new Set(sigs).size).toBe(sigs.length);
    const heroes = new Set(Object.values(LAYOUT_PERSONALITIES).map((p) => `${p.hero[0]}/${p.products[0]}/${p.header[0]}/${p.footer[0]}`));
    expect(heroes.size).toBeGreaterThanOrEqual(12);
  });

  it("fills unset variants by position and never overrides a preset's own choice", () => {
    const base = MARKETPLACE_THEMES.find((t) => t.industry === "furniture")!.preset;
    const raw: ThemePreset = { ...base, headerStyle: undefined, footerLayout: undefined, home: [["Hero", { height: "large" }], ["ProductGrid", { variant: "list" }], ["ProductGrid", {}], ["Hero", { height: "banner" }]] };
    const a = withLayout(raw, "furniture", 0);
    const b = withLayout(raw, "furniture", 1);
    const p = LAYOUT_PERSONALITIES.furniture;
    expect(a.home[0]![1].variant).toBe(p.hero[0]);
    expect(b.home[0]![1].variant).toBe(p.hero[1]);
    expect(a.home[1]![1].variant).toBe("list");
    // The second grid on a page steps one further through the list.
    expect(a.home[2]![1].variant).toBe(p.products[1]);
    // Banner heroes keep the classic layout.
    expect(a.home[3]![1].variant).toBeUndefined();
    expect(a.headerStyle).toBe(p.header[0]);
    expect(b.footerLayout).toBe(p.footer[1]);
    expect(withLayout({ ...raw, headerStyle: "inverted" }, "furniture", 0).headerStyle).toBe("inverted");
    expect(raw.home[0]![1].variant).toBeUndefined();
  });
});

describe("marketplace themes with layouts", () => {
  it("apply to a store as valid configs carrying their variants", () => {
    for (const t of MARKETPLACE_THEMES) {
      const applied = applyThemePreset(DEFAULT_THEME_CONFIG, t.preset);
      const strict = parseThemeConfigStrict(applied);
      expect(strict.ok ? [] : strict.issues.slice(0, 3), t.key).toEqual([]);
      if (!strict.ok) continue;
      const header = strict.config.layout.header.find((s) => s.type === "Header")!;
      expect(header.settings.style, t.key).toBe(t.preset.headerStyle);
      expect(strict.config.layout.footer[0]!.settings.layout, t.key).toBe(t.preset.footerLayout);
      const heroItem = t.preset.home.find(([type]) => type === "Hero");
      const hero = strict.config.templates.home.find((s) => s.type === "Hero" && s.visibility.desktop);
      if (heroItem && hero && typeof heroItem[1].variant === "string") expect(hero.settings.variant, t.key).toBe(heroItem[1].variant);
    }
  });

  it("look different within each category (hero, products, header, footer)", () => {
    const industries = [...new Set(MARKETPLACE_THEMES.map((t) => t.industry))];
    for (const industry of industries) {
      const list = MARKETPLACE_THEMES.filter((t) => t.industry === industry);
      const looks = new Set(list.map((t) => JSON.stringify(layoutSummary(t.preset))));
      expect(looks.size, industry).toBe(list.length);
      if (list.length >= 3) expect(new Set(list.map((t) => layoutSummary(t.preset).hero)).size, industry).toBeGreaterThanOrEqual(3);
    }
  });

  it("look different across categories", () => {
    const first = (industry: string) => layoutSummary(MARKETPLACE_THEMES.find((t) => t.industry === industry)!.preset);
    const looks = ["fashion", "gourmet", "jewellery", "beauty", "furniture", "electronics", "books", "pets", "organic", "sports"].map((i) => JSON.stringify(first(i)));
    expect(new Set(looks).size).toBeGreaterThanOrEqual(8);
  });
});

describe("theme stock imagery", () => {
  it("has curated, credited Unsplash photos for every category and slot", () => {
    const ids = new Set<string>();
    for (const cat of UNSPLASH_CATEGORIES) {
      for (const slot of STOCK_SLOTS) {
        const list = curatedStock(cat, slot);
        expect(list.length, `${cat}/${slot}`).toBeGreaterThanOrEqual(2);
        for (const img of list) {
          expect(img.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?auto=format&fit=crop&q=70$/);
          expect(img.photographer?.url).toMatch(/^https:\/\/unsplash\.com\/@[\w.-]+\?utm_source=pictocart&utm_medium=referral$/);
          expect(img.alt).not.toBe("");
          ids.add(`${cat}:${img.id}`);
        }
      }
      expect(stockCredits(curatedStockSet(cat)).length).toBeGreaterThan(3);
    }
    expect(ids.size).toBeGreaterThan(150);
  });

  it("picks deterministically and wraps around", () => {
    const set = curatedStockSet("food");
    expect(pickStock(set, "tiles", 0)).toEqual(set.tiles[0]);
    expect(pickStock(set, "tiles", set.tiles.length)).toEqual(set.tiles[0]);
    expect(pickStock(set, "tiles", -1)).toEqual(set.tiles.at(-1));
    expect(pickStock(null, "hero")).toBeNull();
    expect(stockIndex("abc")).toBe(stockIndex("abc"));
  });

  it("lists the photos a theme uses, from its industry", () => {
    const bakery = MARKETPLACE_THEMES.find((t) => t.industry === "gourmet")!;
    const imgs = themeUnsplashImages(bakery);
    expect(imgs.length).toBeGreaterThanOrEqual(12);
    expect(new Set(imgs.map((i) => i.category))).toEqual(new Set(["food"]));
    expect(new Set(imgs.map((i) => i.slot))).toEqual(new Set(STOCK_SLOTS));
  });

  it("resizes Unsplash photos through the image loader", () => {
    const url = curatedStock("books", "hero")[0]!.url;
    const out = new URL(imageLoader({ src: url, width: 640 }));
    expect(out.hostname).toBe("images.unsplash.com");
    expect(out.searchParams.get("w")).toBe("640");
    expect(out.searchParams.get("auto")).toBe("format");
  });
});
