import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict, resolveThemeConfig, TEMPLATE_KEYS } from "@/features/theme/schema/config";
import { EMPTY_LINK_TARGETS, linkFromMenuRow, resolveThemeLink, themeLinkSchema, themeMenuRefs, themeMenuToNodes, type ThemeLink, type ThemeLinkTargets } from "@/features/theme/schema/links";
import { defaultSettings } from "@/features/theme/sections/definitions";
import { slotSections, listKeyOf, SLOT_KEY_RE } from "@/features/theme/site-builder/slots";
import { parseCanvasMessage, parseHostMessage, CANVAS_TAG, HOST_TAG } from "@/features/theme/site-builder/protocol";
import { themeCss, typographyCss } from "@/features/theme/tokens-style";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const link = (l: Partial<ThemeLink>): ThemeLink => themeLinkSchema.parse(l);

/** A theme document as saved before the site builder existed. */
const LEGACY = {
  schemaVersion: 1,
  tokens: { colors: { primary: "#112233" }, headingFont: "playfair" },
  header: { menuHandle: "main" },
  layout: { header: [{ id: "hdr-1", type: "Header", settings: {} }], footer: [{ id: "ftr-1", type: "Footer", settings: {} }] },
  templates: {
    home: [{ id: "hero-1", type: "Hero", settings: {} }],
    collection: [{ id: "pc-1", type: "PageContent", settings: {} }],
    product: [],
  },
};

describe("theme document back-compat", () => {
  it("parses a pre-builder theme strictly, with every new part empty / default", () => {
    const r = parseThemeConfigStrict(LEGACY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.config;
    for (const k of TEMPLATE_KEYS) expect(Array.isArray(c.templates[k])).toBe(true);
    expect(c.templates.cart).toEqual([]);
    expect(c.pages).toEqual([]);
    expect(c.popups).toEqual([]);
    expect(c.menus).toEqual({});
    expect(c.embeds).toEqual({ whatsapp: { enabled: false, position: "right", message: expect.any(String) }, backToTop: { enabled: false } });
    expect(c.tokens.typography.h1).toEqual({ size: 0, weight: "default", font: "default", lineHeight: 0 });
    expect(c.templates.home[0]!.style).toBeUndefined();
  });

  it("emits the same token CSS as before for a theme without typography changes", () => {
    const css = themeCss(DEFAULT_THEME_CONFIG.tokens);
    expect(css).not.toContain("font-size");
    expect(typographyCss(DEFAULT_THEME_CONFIG.tokens.typography)).toBe("");
  });

  it("round-trips the default theme unchanged", () => {
    const r = parseThemeConfigStrict(JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual(DEFAULT_THEME_CONFIG);
  });
});

describe("site builder schema additions", () => {
  const base = JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG));

  it("accepts pages, popups, menus, embeds, section styles and new templates", () => {
    const doc = {
      ...base,
      templates: { ...base.templates, cart: [{ id: "cart-faq", type: "FAQ", settings: defaultSettings("FAQ") }, { id: "cart-pc", type: "PageContent", settings: {} }] },
      pages: [{ id: "pabout123", handle: "about-us", title: "About us", sections: [{ id: "ab-hero", type: "Hero", settings: {}, style: { background: "#FFEEDD", text: "", accent: "" } }] }],
      popups: [{ id: "uwelcome1", name: "Welcome" }],
      menus: { main: { title: "Main", items: [{ id: "mhome1234", title: "Home", link: { type: "home" }, children: [{ id: "mchild123", title: "Sale", link: { type: "collection", ref: U1 } }] }] } },
      embeds: { whatsapp: { enabled: true } },
      tokens: { ...base.tokens, typography: { h1: { size: 56, weight: "700" } } },
    };
    const r = parseThemeConfigStrict(doc);
    expect(r.ok, JSON.stringify(!r.ok && r.issues)).toBe(true);
    if (!r.ok) return;
    expect(r.config.pages[0]!.sections[0]!.style).toEqual({ background: "#ffeedd", text: "", accent: "" });
    expect(r.config.popups[0]!.trigger).toBe("delay");
    expect(r.config.menus.main!.items[0]!.children[0]!.link.ref).toBe(U1);
    expect(r.config.tokens.typography.h1.size).toBe(56);
  });

  it("rejects duplicate / reserved page handles and invalid style colours on save", () => {
    const dup = { ...base, pages: [{ id: "paaa1111", handle: "x", title: "A" }, { id: "pbbb2222", handle: "x", title: "B" }] };
    expect(parseThemeConfigStrict(dup).ok).toBe(false);
    expect(parseThemeConfigStrict({ ...base, pages: [{ id: "paaa1111", handle: "home", title: "A" }] }).ok).toBe(false);
    const badStyle = { ...base, templates: { ...base.templates, home: [{ id: "hero-x1", type: "Hero", settings: {}, style: { background: "red;}body{", text: "", accent: "" } }] } };
    expect(parseThemeConfigStrict(badStyle).ok).toBe(false);
    // Render-time parse skips the bad section instead of throwing.
    expect(resolveThemeConfig(badStyle).config.templates.home).toEqual([]);
  });

  it("limits what goes where", () => {
    expect(groupAllows("Hero", "custom")).toBe(true);
    expect(groupAllows("PageContent", "custom")).toBe(false);
    expect(groupAllows("PageContent", "cart")).toBe(true);
    expect(groupAllows("Header", "page")).toBe(false);
    expect(groupAllows("Footer", "account")).toBe(false);
  });

  it("rejects an unsafe web-address link", () => {
    expect(themeLinkSchema.safeParse({ type: "url", url: "javascript:alert(1)" }).success).toBe(false);
    expect(themeLinkSchema.safeParse({ type: "product", ref: "not-a-uuid" }).success).toBe(false);
    expect(themeLinkSchema.safeParse({ type: "page", ref: "builtin:nope" }).success).toBe(false);
  });
});

describe("menu link resolution", () => {
  const t: ThemeLinkTargets = {
    ...EMPTY_LINK_TARGETS,
    products: new Map([[U1, "silk-saree"]]),
    collections: new Map([[U2, "festive"]]),
    pages: new Map([[U1, "shipping"]]),
    blogPosts: new Map([[U2, "how-to-drape"]]),
    themePages: new Set(["about-us"]),
    popups: new Set(["uwelcome1"]),
  };

  it.each([
    [{ type: "none" }, null],
    [{ type: "home" }, { href: "/", external: false }],
    [{ type: "page", ref: "theme:about-us" }, { href: "/pages/about-us", external: false }],
    [{ type: "page", ref: "theme:gone" }, null],
    [{ type: "page", ref: "builtin:contact" }, { href: "/contact", external: false }],
    [{ type: "page", ref: U1 }, { href: "/pages/shipping", external: false }],
    [{ type: "product", ref: U1 }, { href: "/products/silk-saree", external: false }],
    [{ type: "product", ref: U2 }, null],
    [{ type: "collection", ref: U2, newTab: true }, { href: "/collections/festive", external: true }],
    [{ type: "blogPost", ref: "" }, { href: "/blog", external: false }],
    [{ type: "blogPost", ref: U2 }, { href: "/blog/how-to-drape", external: false }],
    [{ type: "blogCategory", ref: "Saree care" }, { href: "/blog?tag=Saree%20care", external: false }],
    [{ type: "url", url: "https://instagram.com/x" }, { href: "https://instagram.com/x", external: true }],
    [{ type: "url", url: "/collections/sale", anchor: "top" }, { href: "/collections/sale#top", external: false }],
    [{ type: "popup", ref: "uwelcome1" }, { href: "#popup-uwelcome1", external: false }],
    [{ type: "popup", ref: "unknown12" }, null],
    [{ type: "home", anchor: "s-hero-1" }, { href: "/#s-hero-1", external: false }],
  ] as [Partial<ThemeLink>, unknown][])("%j", (l, expected) => {
    expect(resolveThemeLink(link(l), t)).toEqual(expected);
  });

  it("builds menu nodes and collects refs", () => {
    const menu = { title: "Main", items: [{ id: "m1aaaaaaa", title: "Shop", highlight: false, link: link({ type: "collection", ref: U2 }), children: [{ id: "m2aaaaaaa", title: "Saree", highlight: true, link: link({ type: "product", ref: U1 }) }] }] };
    const nodes = themeMenuToNodes(menu, t);
    expect(nodes[0]).toMatchObject({ title: "Shop", href: "/collections/festive", children: [{ title: "Saree", href: "/products/silk-saree", highlight: true }] });
    expect(themeMenuRefs({ main: menu })).toEqual({ collection: [U2], product: [U1], page: [], blog: [] });
  });

  it("converts database menu rows", () => {
    expect(linkFromMenuRow({ link_type: "home", link_ref: null, url: null }).type).toBe("home");
    expect(linkFromMenuRow({ link_type: "search", link_ref: null, url: null }).ref).toBe("builtin:search");
    expect(linkFromMenuRow({ link_type: "url", link_ref: null, url: "https://x.com/a" })).toMatchObject({ type: "url", newTab: true });
    expect(linkFromMenuRow({ link_type: "url", link_ref: null, url: "javascript:x" }).type).toBe("none");
    expect(linkFromMenuRow({ link_type: "product", link_ref: U1, url: null })).toMatchObject({ type: "product", ref: U1 });
  });
});

describe("canvas slots and protocol", () => {
  const c = parseThemeConfigStrict(LEGACY);
  it("maps slots to sections", () => {
    if (!c.ok) throw new Error("bad fixture");
    expect(slotSections(c.config, "templates.home")?.map((s) => s.id)).toEqual(["hero-1"]);
    expect(slotSections(c.config, "templates.collection.before")).toEqual([]);
    expect(slotSections(c.config, "layout.header")?.[0]!.type).toBe("Header");
    expect(slotSections(c.config, "templates.nope")).toBeNull();
    expect(listKeyOf("templates.product.after")).toBe("templates.product");
    expect(listKeyOf("templates.page.chrome")).toBe("templates.page");
    expect(SLOT_KEY_RE.test("templates.page.chrome")).toBe(true);
    expect(SLOT_KEY_RE.test("pages.pabout123")).toBe(true);
    expect(SLOT_KEY_RE.test("layout.header;drop")).toBe(false);
  });

  it("validates messages both ways", () => {
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "action", slot: "templates.home", sectionId: "hero-1", action: "delete" })).toMatchObject({ action: "delete" });
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "action", slot: "templates.home", sectionId: "hero-1", action: "rm -rf" })).toBeNull();
    expect(parseCanvasMessage({ tag: "other", type: "ready" })).toBeNull();
    expect(
      parseCanvasMessage({ tag: CANVAS_TAG, type: "textSelect", slot: "templates.home", sectionId: "hero-1", role: "heading", itemIndex: 0 }),
    ).toMatchObject({ type: "textSelect", role: "heading", itemIndex: 0 });
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "textSelect", slot: "templates.home", sectionId: "hero-1", role: "script" })).toBeNull();
    expect(
      parseCanvasMessage({ tag: CANVAS_TAG, type: "textResize", slot: "templates.home", sectionId: "hero-1", role: "cta", widthPct: 72 }),
    ).toMatchObject({ type: "textResize", widthPct: 72 });
    expect(parseCanvasMessage({ tag: CANVAS_TAG, type: "textResize", slot: "templates.home", sectionId: "hero-1", role: "cta", widthPct: 180 })).toBeNull();
    expect(parseHostMessage({ tag: HOST_TAG, type: "theme", rev: 2, config: "{}", changedLists: "all" })).toMatchObject({ rev: 2 });
    expect(parseHostMessage({ tag: HOST_TAG, type: "theme", rev: "2", config: "{}", changedLists: "all" })).toBeNull();
    // The preview token travels with theme messages; anything not shaped like a signed token is dropped.
    const token = "eyJ0IjoiMTAwMDAwMDAifQ.IduECgYdfNkW-xrJir3UsGApouyVR6H4cRRaZh3zEJk";
    expect(parseHostMessage({ tag: HOST_TAG, type: "theme", rev: 3, config: "{}", changedLists: [], token })).toMatchObject({ token });
    expect(parseHostMessage({ tag: HOST_TAG, type: "theme", rev: 3, config: "{}", changedLists: [], token: "<script>" })).not.toHaveProperty("token");
    expect(parseHostMessage({ tag: HOST_TAG, type: "hello" })).toEqual({ tag: HOST_TAG, type: "hello" });
  });
});
