import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { groupAllows, parseThemeConfigStrict } from "@/features/theme/schema/config";
import {
  POPUP_CONTENT_TYPES,
  POPUP_FIELD_TYPES,
  defaultPopupFormFields,
  popupSchema,
} from "@/features/theme/schema/site";
import { addPage, newPopup } from "@/features/theme/site-builder/ops";
import {
  BLANK_TEMPLATE,
  PAGE_TEMPLATE_FAMILY_ORDER,
  PAGE_TEMPLATES,
  pageTemplate,
  pageTemplatesByFamily,
  type PageTemplateFamily,
} from "@/features/theme/site-builder/page-templates";
import { sectionTabs } from "@/features/theme/site-builder/field-groups";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";

const PHASE_E_FAMILIES: PageTemplateFamily[] = ["about", "contact", "faq", "blogs", "blog-detail"];

describe("Phase E page templates", () => {
  it("keeps unique keys across the full starter set", () => {
    const keys = PAGE_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pageTemplate("blank")).toBe(BLANK_TEMPLATE);
    expect(pageTemplate("about")?.family).toBe("about");
    expect(pageTemplate("blog-detail")?.family).toBe("blog-detail");
    expect(pageTemplate("nope")).toBeNull();
  });

  it.each(PHASE_E_FAMILIES)("offers four layouts for %s", (family) => {
    const list = pageTemplatesByFamily(family);
    expect(list).toHaveLength(4);
    for (const t of list) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.sections.length).toBeGreaterThan(0);
      for (const s of t.sections) expect(groupAllows(s.type, "custom")).toBe(true);
    }
  });

  it("groups families in the Add-page order", () => {
    expect(PAGE_TEMPLATE_FAMILY_ORDER.slice(0, 5)).toEqual(PHASE_E_FAMILIES);
  });

  it.each(PAGE_TEMPLATES.map((t) => [t.key, t] as const))("%s validates when added", (_key, t) => {
    const { config, page } = addPage(DEFAULT_THEME_CONFIG, t.label, t.sections);
    expect(page).not.toBeNull();
    const r = parseThemeConfigStrict(config);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.pages.find((p) => p.id === page!.id)!.sections.map((s) => s.type)).toEqual(t.sections.map((s) => s.type));
  });
});

describe("Phase E popup form schema", () => {
  it("defaults contentType to newsletter and accepts a custom form", () => {
    const legacy = popupSchema.parse({ id: "uwelcome01", name: "Welcome", newsletter: true });
    expect(legacy.contentType).toBe("newsletter");
    expect(legacy.form.fields).toEqual([]);
    expect(POPUP_CONTENT_TYPES).toEqual(["newsletter", "form"]);
    expect(POPUP_FIELD_TYPES).toEqual(["text", "email", "phone", "textarea", "select", "radio", "checkbox"]);

    const form = popupSchema.parse({
      id: "uform00001",
      name: "Enquire",
      contentType: "form",
      newsletter: false,
      form: {
        submitLabel: "Send enquiry",
        successMessage: "Thanks — we will reply soon.",
        fields: defaultPopupFormFields(),
      },
    });
    expect(form.contentType).toBe("form");
    expect(form.form.fields).toHaveLength(3);
    expect(form.form.fields.map((f) => f.type)).toEqual(["text", "email", "textarea"]);
    expect(form.form.submitLabel).toBe("Send enquiry");
  });

  it("newPopup seeds newsletter contentType", () => {
    const p = newPopup("Sale");
    expect(p.contentType).toBe("newsletter");
    expect(p.newsletter).toBe(true);
    expect(p.form.submitLabel).toBe("Send");
    const r = parseThemeConfigStrict({ ...DEFAULT_THEME_CONFIG, popups: [p] });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.config.popups[0]!.contentType).toBe("newsletter");
  });

  it("rejects unknown field types and too many fields", () => {
    expect(
      popupSchema.safeParse({
        id: "ubadfield1",
        name: "Bad",
        contentType: "form",
        form: { fields: [{ id: "fxxxxxxx01", type: "file", label: "Upload", required: false }] },
      }).success,
    ).toBe(false);
    expect(
      popupSchema.safeParse({
        id: "utoomany01",
        name: "Many",
        contentType: "form",
        form: {
          fields: Array.from({ length: 9 }, (_, i) => ({
            id: `f${String(i).padStart(8, "0")}`,
            type: "text",
            label: `F${i}`,
            required: false,
            options: [],
          })),
        },
      }).success,
    ).toBe(false);
  });
});

describe("Phase E ecommerce / members panel depth", () => {
  it("default theme seeds PageContent markers on template chrome", () => {
    for (const key of ["collection", "product", "collectionList", "page", "blog", "search", "cart", "account"] as const) {
      expect(DEFAULT_THEME_CONFIG.templates[key].some((s) => s.type === "PageContent"), key).toBe(true);
    }
  });

  it("PageContent still exposes Settings and Colours tabs (empty Edit fields)", () => {
    const tabs = sectionTabs(SECTION_DEFINITIONS.PageContent);
    expect(tabs.edit).toEqual([]);
    expect(tabs.design).toEqual([]);
    // Size/visibility/colours are panel chrome even when definition fields are empty.
    expect(tabs.settings).toEqual([]);
    expect(tabs.colors).toEqual([]);
  });
});
