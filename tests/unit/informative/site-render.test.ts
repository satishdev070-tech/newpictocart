import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INFO_CATEGORY_IDS } from "@/features/informative/categories";
import { DEMO_CONTENT, sampleServices } from "@/features/informative/demo";
import { defaultPageSections } from "@/features/informative/defaults";
import { sectionsSchema, SECTION_TYPES, type PageSection } from "@/features/informative/sections";
import { InformativeSite } from "@/features/informative/site/renderer";
import { buildDemoView } from "@/features/informative/site/view";
import { INFORMATIVE_THEMES } from "@/features/informative/themes/registry";

const all: PageSection[] = SECTION_TYPES.map((type, i) => ({ id: `${type}-${i}`, type, props: type === "rich_text" ? { text: "Hello" } : {}, order: i, visible: true }));
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("demo content", () => {
  it("each category ships 6 services, 3 testimonials and 4 FAQs", () => {
    for (const c of INFO_CATEGORY_IDS) {
      const d = DEMO_CONTENT[c];
      expect(d.services).toHaveLength(6);
      expect(d.testimonials).toHaveLength(3);
      expect(d.faqs).toHaveLength(4);
      for (const s of d.services) if (s.priceType === "FIXED" || s.priceType === "STARTING_FROM") expect(s.pricePaise, `${c}/${s.name}`).not.toBeNull();
      expect(sampleServices(c)).toHaveLength(3);
    }
  });

  it("each theme's demo view has 6 gallery images, credits and the user's name when given", () => {
    for (const t of INFORMATIVE_THEMES) {
      const v = buildDemoView(t);
      expect(v.gallery).toHaveLength(6);
      expect(v.credits.length).toBeGreaterThan(0);
      expect(v.preview).toBe(true);
    }
    const v = buildDemoView(INFORMATIVE_THEMES[0]!, { businessName: "  Asha's Studio  ", link: (p) => `/x?p=${p}` });
    expect(v.businessName).toBe("Asha's Studio");
    expect(v.nav[1]?.href).toBe("/x?p=/about");
  });
});

describe("default pages", () => {
  it("system pages get valid sections; home follows the theme", () => {
    for (const t of INFORMATIVE_THEMES) {
      for (const page of ["HOME", "ABOUT", "SERVICES", "CONTACT"] as const) {
        const s = defaultPageSections(t, page);
        expect(sectionsSchema.safeParse(s).success, `${t.id}/${page}`).toBe(true);
      }
      expect(defaultPageSections(t, "HOME").map((s) => s.type)).toEqual(t.defaultSections);
    }
  });
});

describe("section library renders every section in every theme", () => {
  for (const t of INFORMATIVE_THEMES) {
    it(t.id, () => {
      const view = buildDemoView(t);
      const html = render(createElement(InformativeSite, { theme: t, view, sections: all }));
      expect(html).toContain(`data-informative-theme="${t.id}"`);
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1); // one h1: the hero
      for (const type of SECTION_TYPES) expect(html, type).toContain(`data-section="${type}"`);
      // Images: only hero / logo are eager; everything else lazy, all sized.
      const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
      expect(imgs.length).toBeGreaterThan(5);
      for (const img of imgs) {
        expect(img).toMatch(/width="\d+"/);
        expect(img).toMatch(/height="\d+"/);
        expect(img).toMatch(/alt="/);
      }
      expect(imgs.filter((i) => i.includes('loading="eager"')).length).toBeLessThanOrEqual(2);
      // Preview: the enquiry form cannot be sent; honeypot present; no inline scripts.
      expect(html).toMatch(/<fieldset disabled/);
      expect(html).toContain('name="website"');
      expect(html).not.toContain("<script");
      // Motion is opt-in only.
      expect(html).not.toMatch(/(?<!motion-safe:)\b(transition|scroll-smooth|animate-)/);
    });
  }

  it("non-home pages put the page title in the only h1", () => {
    const t = INFORMATIVE_THEMES[0]!;
    const html = render(createElement(InformativeSite, { theme: t, view: buildDemoView(t), sections: defaultPageSections(t, "ABOUT"), pageTitle: "About" }));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>About<\/h1>/);
  });

  it("hidden sections are not rendered", () => {
    const t = INFORMATIVE_THEMES[0]!;
    const html = render(createElement(InformativeSite, { theme: t, view: buildDemoView(t), sections: [{ id: "f", type: "faq", props: {}, order: 0, visible: false }] }));
    expect(html).not.toContain('data-section="faq"');
  });
});
