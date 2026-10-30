import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict, type ThemeConfig } from "@/features/theme/schema/config";
import { addPage, applyPageTemplate } from "@/features/theme/site-builder/ops";
import { BLANK_TEMPLATE, PAGE_TEMPLATES, pageTemplate } from "@/features/theme/site-builder/page-templates";
import { groupOfList } from "@/features/theme/site-builder/slots";

describe("applyPageTemplate", () => {
  it("replaces sections and preserves title, handle, and SEO fields", () => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Our story", PAGE_TEMPLATES.find((t) => t.key === "about")!.sections);
    expect(page).not.toBeNull();
    const withSeo: ThemeConfig = {
      ...config,
      pages: config.pages.map((p) =>
        p.id === page!.id
          ? { ...p, seoTitle: "Story SEO", seoDescription: "About us", socialImagePath: "stores/x/cover.jpg", noindex: true }
          : p,
      ),
    };
    const contact = pageTemplate("contact")!;
    const next = applyPageTemplate(withSeo, page!.id, contact.key);
    const updated = next.pages.find((p) => p.id === page!.id)!;

    expect(updated.title).toBe("Our story");
    expect(updated.handle).toBe("our-story");
    expect(updated.seoTitle).toBe("Story SEO");
    expect(updated.seoDescription).toBe("About us");
    expect(updated.socialImagePath).toBe("stores/x/cover.jpg");
    expect(updated.noindex).toBe(true);
    expect(updated.sections.map((s) => s.type)).toEqual(contact.sections.map((s) => s.type));
    expect(updated.sections).toHaveLength(contact.sections.length);
    expect(updated.sections.every((s) => s.id && s.id !== page!.sections[0]?.id)).toBe(true);
  });

  it("gives fresh section ids distinct from the previous list and from addPage", () => {
    const a = addPage(DEFAULT_THEME_CONFIG, "A", PAGE_TEMPLATES[0]!.sections);
    const beforeIds = new Set(a.page!.sections.map((s) => s.id));
    const next = applyPageTemplate(a.config, a.page!.id, PAGE_TEMPLATES[0]!.key);
    const after = next.pages.find((p) => p.id === a.page!.id)!;
    for (const s of after.sections) {
      expect(beforeIds.has(s.id)).toBe(false);
      expect(s.id).toMatch(/^s[a-z0-9]{9}$/);
    }
  });

  it("applies the blank template (clears sections)", () => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Gallery", pageTemplate("gallery")!.sections);
    const next = applyPageTemplate(config, page!.id, BLANK_TEMPLATE.key);
    const updated = next.pages.find((p) => p.id === page!.id)!;
    expect(updated.title).toBe("Gallery");
    expect(updated.handle).toBe("gallery");
    expect(updated.sections).toEqual([]);
  });

  it("is a no-op for unknown page or template ids", () => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Keep", PAGE_TEMPLATES[0]!.sections);
    expect(applyPageTemplate(config, "pmissing00", "about")).toBe(config);
    expect(applyPageTemplate(config, page!.id, "no-such-template")).toBe(config);
  });

  it.each(PAGE_TEMPLATES.map((t) => [t.key, t] as const))("%s validates through the strict parser after apply", (key, t) => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, "Scratch", []);
    const next = applyPageTemplate(config, page!.id, key);
    const r = parseThemeConfigStrict(next);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    const saved = r.config.pages.find((p) => p.id === page!.id)!;
    expect(saved.sections.map((s) => s.type)).toEqual(t.sections.map((s) => s.type));
    for (const s of saved.sections) expect(groupAllows(s.type, "custom")).toBe(true);
  });

  it("treats theme page lists as the custom (Home-like) section group", () => {
    const { page } = addPage(DEFAULT_THEME_CONFIG, "About", []);
    expect(groupOfList(`pages.${page!.id}`)).toBe("custom");
    expect(groupAllows("Hero", "custom")).toBe(true);
    expect(groupAllows("ContactInfo", "custom")).toBe(true);
    expect(groupAllows("PageContent", "custom")).toBe(false);
  });
});
