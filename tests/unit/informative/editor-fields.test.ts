import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECTION_TYPES, sectionsSchema, type PageSection } from "@/features/informative/sections";
import { compactProps, compactSections, fieldProblems, isSafeHref, SECTION_FIELDS, STYLE_FIELDS } from "@/features/informative/editor/fields";

/**
 * Website editor field schema vs the renderer. The editor may only expose props the renderer reads,
 * or props in the contract agreed with the renderer slice (EDITOR_PLAN.md, lead's prop list) that
 * the renderer is being extended to read. Every prop the renderer reads must be editable.
 */
const COMMON = ["eyebrow", "heading", "subheading", "background", "backgroundImage", "align", "spacing"];
const CONTRACT: Record<string, string[]> = {
  hero: ["text", "image", "layout", "primaryCta", "secondaryCta"],
  about: ["text", "image", "imagePosition"],
  services_grid: ["limit", "showPrices", "ctaLabel"],
  services_list: ["limit", "showPrices", "ctaLabel"],
  highlights: ["items"],
  stats: ["items"],
  team: ["limit"],
  gallery: ["limit", "layout"],
  testimonials: ["limit", "layout"],
  faq: ["limit"],
  pricing: ["items"],
  cta: ["text", "image", "primaryCta", "secondaryCta"],
  contact: ["showMap", "showHours"],
  enquiry_form: ["text", "serviceId"],
  rich_text: ["text"],
};

const source = readFileSync("src/features/informative/site/sections.tsx", "utf8");
/** Prop keys the renderer reads: helper calls on section.props / props and direct property reads. */
function rendererKeys(): Set<string> {
  const keys = new Set<string>();
  for (const m of source.matchAll(/\(\s*(?:section\.)?props\s*,\s*"([A-Za-z0-9_]+)"/g)) keys.add(m[1]!);
  for (const m of source.matchAll(/section\.props(?:\.([A-Za-z0-9_]+)|\["([A-Za-z0-9_]+)"\])/g)) keys.add((m[1] ?? m[2])!);
  return keys;
}

describe("editor field schema", () => {
  it("covers all 15 section types", () => {
    expect(SECTION_TYPES).toHaveLength(15);
    for (const t of SECTION_TYPES) {
      const meta = SECTION_FIELDS[t];
      expect(meta.label, t).toBeTruthy();
      expect(meta.description, t).toBeTruthy();
      expect(meta.fields.length, t).toBeGreaterThan(0);
      const keys = meta.fields.map((f) => f.key);
      expect(new Set(keys).size, `${t} has duplicate keys`).toBe(keys.length);
      for (const s of STYLE_FIELDS) expect(keys, t).toContain(s.key);
    }
  });

  it("every prop the renderer reads is editable", () => {
    const all = new Set(SECTION_TYPES.flatMap((t) => SECTION_FIELDS[t].fields.map((f) => f.key)));
    const read = rendererKeys();
    expect(read.size).toBeGreaterThan(0);
    for (const k of read) expect(all.has(k), `renderer reads "${k}" but no editor field sets it`).toBe(true);
    // Today's reads, per type.
    expect(SECTION_FIELDS.hero.fields.map((f) => f.key)).toEqual(expect.arrayContaining(["heading", "subheading"]));
    expect(SECTION_FIELDS.enquiry_form.fields.map((f) => f.key)).toContain("serviceId");
    for (const t of ["about", "cta", "rich_text"] as const) expect(SECTION_FIELDS[t].fields.map((f) => f.key)).toContain("text");
  });

  it("only exposes props the renderer reads or the agreed renderer contract", () => {
    const read = rendererKeys();
    for (const t of SECTION_TYPES) {
      const allowed = new Set([...COMMON, ...CONTRACT[t]!, ...read]);
      for (const f of SECTION_FIELDS[t].fields) expect(allowed.has(f.key), `${t}.${f.key}`).toBe(true);
    }
  });

  it("list fields have bounded, scalar sub-fields", () => {
    for (const t of SECTION_TYPES)
      for (const f of SECTION_FIELDS[t].fields)
        if (f.kind === "list") {
          expect(f.max).toBeGreaterThan(0);
          expect(f.max).toBeLessThanOrEqual(8);
          for (const sub of f.fields) expect((sub as { kind: string }).kind).not.toBe("list");
        }
    const pricing = SECTION_FIELDS.pricing.fields.find((f) => f.key === "items");
    expect(pricing?.kind === "list" && pricing.fields.map((f) => f.key)).toEqual(["name", "price", "features", "highlighted", "ctaLabel", "ctaHref"]);
  });
});

describe("editor values", () => {
  it("accepts site paths, anchors, https, tel, mailto and WhatsApp links only", () => {
    for (const ok of ["", "/contact", "#enquiry", "https://example.com/x", "https://wa.me/919876543210", "tel:+91 98765 43210", "mailto:a@b.in"]) expect(isSafeHref(ok), ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.com", "data:text/html,x", "ftp://x", "http//x", " javascript:alert(1)"]) expect(isSafeHref(bad), bad).toBe(false);
  });

  it("compacts props so the renderer's fallbacks apply", () => {
    expect(compactProps({ heading: "  Hi ", subheading: "  ", primaryCta: { label: "", href: "" }, items: [{ title: "" }, { title: "A" }], showMap: false, limit: 3 })).toEqual({
      heading: "Hi",
      items: [{ title: "A" }],
      showMap: false,
      limit: 3,
    });
    const s: PageSection[] = [{ id: "cta-0", type: "cta", props: { text: " x " }, order: 7, visible: true }];
    expect(compactSections(s)).toEqual([{ id: "cta-0", type: "cta", props: { text: "x" }, order: 0, visible: true }]);
    expect(sectionsSchema.safeParse(compactSections(s)).success).toBe(true);
  });

  it("flags unsafe button links, including list items", () => {
    const s: PageSection[] = [
      { id: "hero-0", type: "hero", props: { primaryCta: { label: "Go", href: "javascript:alert(1)" } }, order: 0, visible: true },
      { id: "pricing-0", type: "pricing", props: { items: [{ name: "A", ctaHref: "/contact" }, { name: "B", ctaHref: "javascript:x" }] }, order: 1, visible: true },
    ];
    expect(Object.keys(fieldProblems(s)).sort()).toEqual(["hero-0.primaryCta", "pricing-0.items.1.ctaHref"]);
  });
});
