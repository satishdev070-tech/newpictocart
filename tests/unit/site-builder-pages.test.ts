import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict, type ThemeConfig } from "@/features/theme/schema/config";
import { addPage, newPopup, slugify, uniqueHandle } from "@/features/theme/site-builder/ops";
import { BLANK_TEMPLATE, PAGE_TEMPLATES, pageTemplate } from "@/features/theme/site-builder/page-templates";
import { builderPages, pageForPath, type PageSources } from "@/features/theme/site-builder/pages";

const SOURCES: PageSources = {
  contentPages: [{ id: "11111111-1111-4111-8111-111111111111", title: "Shipping", slug: "shipping" }],
  sampleProductSlug: "kurta",
  sampleCollectionSlug: "festive",
  blog: true,
};

describe("page templates", () => {
  it("has the expected starter set with unique keys", () => {
    const keys = PAGE_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PAGE_TEMPLATES.map((t) => t.label)).toEqual(["About", "Blogs", "Collection", "Contact", "FAQ", "Gallery", "Privacy Policy", "Shop", "Team", "Why Us"]);
    expect(pageTemplate("blank")).toBe(BLANK_TEMPLATE);
    expect(pageTemplate("about")?.label).toBe("About");
    expect(pageTemplate("nope")).toBeNull();
  });

  it.each(PAGE_TEMPLATES.map((t) => [t.label, t] as const))("%s uses only section types allowed on pages", (_label, t) => {
    expect(t.sections.length).toBeGreaterThan(0);
    for (const s of t.sections) expect(groupAllows(s.type, "custom")).toBe(true);
  });

  it.each([BLANK_TEMPLATE, ...PAGE_TEMPLATES].map((t) => [t.label, t] as const))("%s validates through the strict parser when added", (label, t) => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, label, t.sections);
    expect(page).not.toBeNull();
    const r = parseThemeConfigStrict(config);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const saved = r.config.pages.find((p) => p.id === page!.id)!;
    expect(saved.sections).toHaveLength(t.sections.length);
    expect(saved.sections.map((s) => s.type)).toEqual(t.sections.map((s) => s.type));
  });

  it("all templates together still validate (unique handles and ids)", () => {
    let config: ThemeConfig = DEFAULT_THEME_CONFIG;
    for (const t of PAGE_TEMPLATES) config = addPage(config, t.label, t.sections).config;
    config = addPage(config, "About", PAGE_TEMPLATES[0]!.sections).config;
    expect(config.pages).toHaveLength(PAGE_TEMPLATES.length + 1);
    expect(config.pages.at(-1)!.handle).toBe("about-2");
    const r = parseThemeConfigStrict(config);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.pages).toHaveLength(PAGE_TEMPLATES.length + 1);
  });

  it("gives sections fresh ids each time a template is used", () => {
    const a = addPage(DEFAULT_THEME_CONFIG, "A", PAGE_TEMPLATES[0]!.sections);
    const b = addPage(a.config, "B", PAGE_TEMPLATES[0]!.sections);
    expect(a.page!.sections[0]!.id).not.toBe(b.page!.sections[0]!.id);
  });
});

describe("slugify / uniqueHandle", () => {
  it("slugifies titles", () => {
    expect(slugify("Privacy Policy")).toBe("privacy-policy");
    expect(slugify("  Why Us?! ")).toBe("why-us");
    expect(slugify("Café & Co")).toBe("cafe-co");
    expect(slugify("***")).toBe("page");
    expect(slugify("a".repeat(100))).toHaveLength(60);
  });

  it("avoids taken and reserved handles", () => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "About");
    expect(page!.handle).toBe("about");
    expect(uniqueHandle(config, "About")).toBe("about-2");
    expect(uniqueHandle(config, "About", page!.id)).toBe("about");
    expect(uniqueHandle(config, "Home")).toBe("home-2");
    expect(uniqueHandle(config, "preview")).toBe("preview-2");
  });
});

describe("builderPages / pageForPath", () => {
  const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Our story");
  const pages = builderPages({ ...config, popups: [{ ...newPopup("Welcome"), id: "uabcdefghi" }] }, SOURCES);

  it("lists home first, theme pages, content pages and the other groups", () => {
    expect(pages[0]!.key).toBe("home");
    const theme = pages.find((p) => p.key === `theme:${page!.id}`)!;
    expect(theme).toMatchObject({ group: "pages", path: "/pages/our-story", list: `pages.${page!.id}`, themePageId: page!.id });
    expect(pages.find((p) => p.key.startsWith("content:"))).toMatchObject({ path: "/pages/shipping", settingsHref: "/dashboard/content/pages/11111111-1111-4111-8111-111111111111" });
    expect(pages.some((p) => p.group === "ecommerce" && p.key === "product")).toBe(true);
    expect(pages.some((p) => p.group === "members")).toBe(true);
    expect(pages.find((p) => p.group === "popups")).toMatchObject({ key: "popup:uabcdefghi", popupId: "uabcdefghi", list: null });
  });

  it("omits blog and product when the store has none", () => {
    const bare = builderPages(DEFAULT_THEME_CONFIG, { contentPages: [], sampleProductSlug: null, sampleCollectionSlug: null, blog: false });
    expect(bare.some((p) => p.key === "blog" || p.key === "product")).toBe(false);
    expect(bare.find((p) => p.key === "product-list")!.list).toBe("templates.collectionList");
  });

  it("maps canvas paths back to registry pages", () => {
    expect(pageForPath(pages, "/")!.key).toBe("home");
    expect(pageForPath(pages, "/pages/our-story/?x=1#top")!.key).toBe(`theme:${page!.id}`);
    expect(pageForPath(pages, "/products/anything")!.key).toBe("product");
    expect(pageForPath(pages, "/categories/sarees")!.key).toBe("product-list");
    expect(pageForPath(pages, "/blog/some-post")!.key).toBe("blog");
    expect(pageForPath(pages, "/account/orders")!.key).toBe("account");
    expect(pageForPath(pages, "/nowhere")).toBeNull();
  });
});
