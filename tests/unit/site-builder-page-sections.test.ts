import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict, resolveThemeConfig } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import { PAGE_SECTION_DEFINITIONS, mapsEmbedUrl, parseMapsEmbedUrl } from "@/features/theme/sections/definitions-pages";
import { addPage, changedLists, removePage } from "@/features/theme/site-builder/ops";
import { nestPageInMenu, pageLink, setBuiltinTitle, setHomePage } from "@/features/theme/site-builder/page-ops";
import { PAGE_TEMPLATES } from "@/features/theme/site-builder/page-templates";
import { builderPages, type PageSources } from "@/features/theme/site-builder/pages";
import { slotList, slotSections } from "@/features/theme/site-builder/slots";
import { DIAGRAMS_PAGES } from "@/features/theme/site-builder/variant-diagrams-pages";
import type { SectionType } from "@/features/theme/sections/types";

const SOURCES: PageSources = { contentPages: [], sampleProductSlug: null, sampleCollectionSlug: null, blog: true };
const NEW_TYPES = Object.keys(PAGE_SECTION_DEFINITIONS) as SectionType[];

describe("page sections", () => {
  it("registers six new section types", () => {
    expect(NEW_TYPES.sort()).toEqual(["BlogPosts", "CallToAction", "ContactInfo", "Gallery", "RichText", "Team"]);
    for (const t of NEW_TYPES) expect(SECTION_DEFINITIONS[t]).toBe(PAGE_SECTION_DEFINITIONS[t as keyof typeof PAGE_SECTION_DEFINITIONS]);
  });

  it.each(NEW_TYPES)("%s default-parses, is allowed on home and custom pages, and has ≥3 diagrammed variants", (t) => {
    const def = SECTION_DEFINITIONS[t];
    expect(() => defaultSettings(t)).not.toThrow();
    expect(groupAllows(t, "home")).toBe(true);
    expect(groupAllows(t, "custom")).toBe(true);
    const variant = def.fields.find((f) => f.key === "variant");
    expect(variant?.kind).toBe("select");
    const options = variant && variant.kind === "select" ? variant.options : [];
    expect(options.length).toBeGreaterThanOrEqual(3);
    for (const o of options) {
      expect(DIAGRAMS_PAGES[o.value]).toBeDefined();
      expect(def.schema.safeParse({ variant: o.value }).success).toBe(true);
    }
    expect(def.schema.safeParse({ variant: "nope" }).success).toBe(false);
  });

  it("rejects HTML-ish and unsafe values", () => {
    expect(SECTION_DEFINITIONS.RichText.schema.safeParse({ ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(SECTION_DEFINITIONS.Gallery.schema.safeParse({ items: [{ imagePath: "https://evil.example/x.png" }] }).success).toBe(false);
    expect(SECTION_DEFINITIONS.ContactInfo.schema.safeParse({ email: "not an email" }).success).toBe(false);
    expect(SECTION_DEFINITIONS.Team.schema.safeParse({ members: [{ name: "A", href: "//evil.example" }] }).success).toBe(false);
  });
});

describe("Google Maps embed allowlist", () => {
  const ok = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770";
  it("accepts embed URLs and pasted iframe HTML", () => {
    expect(parseMapsEmbedUrl(ok)).toBe(ok);
    expect(parseMapsEmbedUrl(`<iframe src="${ok}&amp;hl=en" width="600" height="450" style="border:0;" allowfullscreen=""></iframe>`)).toBe(`${ok}&hl=en`);
    expect(mapsEmbedUrl.parse(ok)).toBe(ok);
    expect(mapsEmbedUrl.parse("")).toBe("");
  });
  it.each([
    "http://www.google.com/maps/embed?pb=1",
    "https://google.com/maps/embed?pb=1",
    "https://maps.google.com/maps/embed?pb=1",
    "https://www.google.com.evil.example/maps/embed?pb=1",
    "https://www.google.com/maps/place/Jaipur",
    "https://www.google.com/maps/embed",
    "https://user:pw@www.google.com/maps/embed?pb=1",
    "https://www.google.com:8443/maps/embed?pb=1",
    "javascript:alert(1)",
    "https://evil.example/?u=https://www.google.com/maps/embed?pb=1",
  ])("rejects %s", (url) => {
    expect(parseMapsEmbedUrl(url)).toBeNull();
    expect(mapsEmbedUrl.safeParse(url).success).toBe(false);
  });
});

describe("homepage and page meta", () => {
  it("old themes parse with homePageId empty and default page meta", () => {
    const raw = JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)) as Record<string, unknown>;
    delete raw.homePageId;
    delete raw.builtinTitles;
    raw.pages = [{ id: "pabcdefghi", handle: "about", title: "About", sections: [] }];
    const r = parseThemeConfigStrict(raw);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.homePageId).toBe("");
    expect(r.config.builtinTitles).toEqual({ blog: "", contact: "", faq: "" });
    expect(r.config.pages[0]).toMatchObject({ socialImagePath: "", noindex: false, seoTitle: "" });
  });

  it("keeps a valid homePageId and drops a dangling one", () => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Landing");
    const withHome = setHomePage(config, page!.id);
    expect(resolveThemeConfig(withHome).config.homePageId).toBe(page!.id);
    expect(resolveThemeConfig({ ...withHome, homePageId: "pmissing00" }).config.homePageId).toBe("");
    expect(resolveThemeConfig({ ...withHome, homePageId: 42 }).config.homePageId).toBe("");
    expect(removePage(withHome, page!.id).homePageId).toBe("");
    expect(setHomePage(config, "pmissing00").homePageId).toBe("");
  });

  it("routes the home slot and the Home row to the homepage's sections", () => {
    const tpl = PAGE_TEMPLATES.find((t) => t.key === "about")!;
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "About", tpl.sections);
    const home = setHomePage(config, page!.id);
    expect(slotList(home, "templates.home")).toBe(`pages.${page!.id}`);
    expect(slotSections(home, "templates.home")).toBe(home.pages[0]!.sections);
    expect(slotList(config, "templates.home")).toBe("templates.home");
    const rows = builderPages(home, SOURCES);
    expect(rows[0]).toMatchObject({ key: "home", label: "About", list: `pages.${page!.id}`, themePageId: page!.id });
    expect(rows.some((r) => r.key === `theme:${page!.id}`)).toBe(false);
    expect(changedLists(config, home)).toBe("all");
    const edited = { ...home, pages: home.pages.map((p) => ({ ...p, sections: p.sections.slice(1) })) };
    expect(changedLists(home, edited)).toEqual([`pages.${page!.id}`, "templates.home"]);
  });

  it("renames built-in pages", () => {
    const c = setBuiltinTitle(DEFAULT_THEME_CONFIG, "blog", "  Stories ");
    expect(c.builtinTitles.blog).toBe("Stories");
    expect(builderPages(c, SOURCES).find((p) => p.key === "blog")?.label).toBe("Stories");
    expect(parseThemeConfigStrict(c).ok).toBe(true);
  });
});

describe("set as subitem", () => {
  it("nests a page under another in the header menu copy and validates", () => {
    let c = addPage(DEFAULT_THEME_CONFIG, "About").config;
    c = addPage(c, "Team").config;
    const rows = builderPages(c, SOURCES);
    const about = rows.find((r) => r.label === "About")!;
    const team = rows.find((r) => r.label === "Team")!;
    const r = nestPageInMenu(c, {}, { title: "Team", link: pageLink(c, team)! }, { title: "About", link: pageLink(c, about)! });
    expect(r.error).toBeUndefined();
    const menu = r.config.menus[r.config.header.menuHandle]!;
    const parent = menu.items.find((i) => i.link.ref === "theme:about")!;
    expect(parent.children.map((x) => x.link.ref)).toEqual(["theme:team"]);
    expect(parseThemeConfigStrict(r.config).ok).toBe(true);
    // Back to the top level.
    const back = nestPageInMenu(r.config, {}, { title: "Team", link: pageLink(c, team)! }, null);
    const m2 = back.config.menus[back.config.header.menuHandle]!;
    expect(m2.items.find((i) => i.link.ref === "theme:about")!.children).toEqual([]);
    expect(m2.items.some((i) => i.link.ref === "theme:team")).toBe(true);
  });

  it("refuses to nest a page under itself", () => {
    const c = addPage(DEFAULT_THEME_CONFIG, "About").config;
    const about = builderPages(c, SOURCES).find((r) => r.label === "About")!;
    const link = pageLink(c, about)!;
    expect(nestPageInMenu(c, {}, { title: "About", link }, { title: "About", link }).error).toBeTruthy();
  });
});

describe("page templates with page sections", () => {
  it.each(["about", "contact", "blogs", "gallery", "team", "privacy"])("%s uses the page sections and validates strictly", (key) => {
    const t = PAGE_TEMPLATES.find((x) => x.key === key)!;
    expect(t.sections.some((s) => NEW_TYPES.includes(s.type))).toBe(true);
    const { config } = addPage(DEFAULT_THEME_CONFIG, t.label, t.sections);
    const r = parseThemeConfigStrict(config);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
  });
});
