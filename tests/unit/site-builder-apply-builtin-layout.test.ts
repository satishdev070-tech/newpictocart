import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict, type ThemeConfig } from "@/features/theme/schema/config";
import { applyBuiltinTemplateLayout } from "@/features/theme/site-builder/ops";
import { BLANK_TEMPLATE, HOME_LAYOUT_PACKS, PAGE_TEMPLATES, pageTemplate } from "@/features/theme/site-builder/page-templates";

describe("applyBuiltinTemplateLayout", () => {
  it("replaces templates.home with a home pack and gives fresh section ids", () => {
    const pack = HOME_LAYOUT_PACKS.find((t) => t.key === "home-classic")!;
    const beforeIds = new Set(DEFAULT_THEME_CONFIG.templates.home.map((s) => s.id));
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "home", pack.key);
    expect(next.templates.home.map((s) => s.type)).toEqual(pack.sections.map((s) => s.type));
    for (const s of next.templates.home) {
      expect(beforeIds.has(s.id)).toBe(false);
      expect(s.id).toMatch(/^s[a-z0-9]{9}$/);
    }
    // Other templates untouched.
    expect(next.templates.page).toBe(DEFAULT_THEME_CONFIG.templates.page);
    expect(next.templates.blog).toBe(DEFAULT_THEME_CONFIG.templates.blog);
  });

  it("clears templates.home with the blank pack", () => {
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "home", BLANK_TEMPLATE.key);
    expect(next.templates.home).toEqual([]);
  });

  it("applies a contact pack onto templates.page and preserves PageContent", () => {
    const contact = pageTemplate("contact")!;
    const prevMarker = DEFAULT_THEME_CONFIG.templates.page.find((s) => s.type === "PageContent")!;
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "page", contact.key);
    const types = next.templates.page.map((s) => s.type);
    expect(types.slice(0, -1)).toEqual(contact.sections.map((s) => s.type));
    expect(types.at(-1)).toBe("PageContent");
    const marker = next.templates.page.find((s) => s.type === "PageContent")!;
    expect(marker.id).toBe(prevMarker.id);
    expect(marker.settings).toEqual(prevMarker.settings);
  });

  it("applies an faq pack onto the shared templates.page list", () => {
    const faq = pageTemplate("faq")!;
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "page", faq.key);
    expect(next.templates.page.map((s) => s.type)).toEqual([...faq.sections.map((s) => s.type), "PageContent"]);
  });

  it("applies a blogs pack onto templates.blog and keeps PageContent", () => {
    const blogs = pageTemplate("blogs")!;
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "blog", blogs.key);
    expect(next.templates.blog.map((s) => s.type)).toEqual([...blogs.sections.map((s) => s.type), "PageContent"]);
    expect(next.templates.page).toBe(DEFAULT_THEME_CONFIG.templates.page);
  });

  it("inserts a PageContent marker when the template list had none", () => {
    const stripped: ThemeConfig = {
      ...DEFAULT_THEME_CONFIG,
      templates: { ...DEFAULT_THEME_CONFIG.templates, page: [] },
    };
    const next = applyBuiltinTemplateLayout(stripped, "page", "contact");
    expect(next.templates.page.some((s) => s.type === "PageContent")).toBe(true);
    expect(next.templates.page.at(-1)!.type).toBe("PageContent");
  });

  it("is a no-op for wrong family, blank on page/blog, or unknown pack", () => {
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "home", "contact")).toBe(DEFAULT_THEME_CONFIG);
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "page", "home-classic")).toBe(DEFAULT_THEME_CONFIG);
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "blog", "about")).toBe(DEFAULT_THEME_CONFIG);
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "page", BLANK_TEMPLATE.key)).toBe(DEFAULT_THEME_CONFIG);
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "blog", BLANK_TEMPLATE.key)).toBe(DEFAULT_THEME_CONFIG);
    expect(applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "home", "no-such-pack")).toBe(DEFAULT_THEME_CONFIG);
  });

  it.each(HOME_LAYOUT_PACKS.map((t) => [t.key, t] as const))("%s home pack validates through the strict parser", (key, t) => {
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "home", key);
    const r = parseThemeConfigStrict(next);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.templates.home.map((s) => s.type)).toEqual(t.sections.map((s) => s.type));
    for (const s of r.config.templates.home) expect(groupAllows(s.type, "home")).toBe(true);
  });

  it.each(
    PAGE_TEMPLATES.filter((t) => t.family === "contact" || t.family === "faq").map((t) => [t.key, t] as const),
  )("%s page pack validates with PageContent through the strict parser", (key, t) => {
    const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "page", key);
    const r = parseThemeConfigStrict(next);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.templates.page.map((s) => s.type)).toEqual([...t.sections.map((s) => s.type), "PageContent"]);
  });

  it.each(PAGE_TEMPLATES.filter((t) => t.family === "blogs").map((t) => [t.key, t] as const))(
    "%s blog pack validates with PageContent through the strict parser",
    (key, t) => {
      const next = applyBuiltinTemplateLayout(DEFAULT_THEME_CONFIG, "blog", key);
      const r = parseThemeConfigStrict(next);
      if (!r.ok) throw new Error(JSON.stringify(r.issues));
      expect(r.config.templates.blog.map((s) => s.type)).toEqual([...t.sections.map((s) => s.type), "PageContent"]);
    },
  );
});
