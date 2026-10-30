import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { pageChromeClass, pageContentSettings, templatePageContent } from "@/features/theme/render/page-content";
import { POPUP_LAYOUTS, popupSchema } from "@/features/theme/schema/site";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import { ACCOUNT_PACK_VARIANTS, PAGE_CHROME_VARIANTS } from "@/features/theme/sections/variants";
import { sectionTabs } from "@/features/theme/site-builder/field-groups";

describe("PageContent chrome + account packs", () => {
  it("exposes five shop chrome options and five account packs", () => {
    expect(PAGE_CHROME_VARIANTS.map((o) => o.value)).toEqual(["classic", "sidebar", "minimal", "editorial", "dense"]);
    expect(ACCOUNT_PACK_VARIANTS.map((o) => o.value)).toEqual(["image-left", "image-right", "stacked", "minimal", "brand-panel"]);
  });

  it("defaults empty PageContent settings to classic chrome and image-left pack", () => {
    const s = defaultSettings("PageContent");
    expect(s.chrome).toBe("classic");
    expect(s.pack).toBe("image-left");
    expect(s.imagePath).toBe("");
    expect(SECTION_DEFINITIONS.PageContent.schema.parse({}).chrome).toBe("classic");
    expect(SECTION_DEFINITIONS.PageContent.schema.parse({ chrome: "dense", pack: "brand-panel" })).toMatchObject({
      chrome: "dense",
      pack: "brand-panel",
    });
  });

  it("rejects unknown chrome / pack values", () => {
    expect(SECTION_DEFINITIONS.PageContent.schema.safeParse({ chrome: "neon" }).success).toBe(false);
    expect(SECTION_DEFINITIONS.PageContent.schema.safeParse({ pack: "split" }).success).toBe(false);
  });

  it("wires Change design variant cards for chrome and pack", () => {
    const tabs = sectionTabs(SECTION_DEFINITIONS.PageContent);
    expect(tabs.design.map((f) => f.key)).toEqual(["chrome", "pack"]);
    expect(tabs.edit.map((f) => f.key)).toEqual(["imagePath"]);
    for (const f of tabs.design) {
      expect(f.kind).toBe("select");
      if (f.kind === "select") expect(f.display).toBe("variants");
    }
  });

  it("seeds default theme markers with schema defaults", () => {
    for (const key of ["collection", "product", "collectionList", "search", "cart", "account"] as const) {
      const marker = DEFAULT_THEME_CONFIG.templates[key].find((s) => s.type === "PageContent");
      expect(marker, key).toBeTruthy();
      const s = pageContentSettings(marker);
      expect(s.chrome).toBe("classic");
      expect(s.pack).toBe("image-left");
      expect(pageChromeClass(s.chrome)).toBe("sf-page-chrome sf-page-chrome-classic");
    }
    expect(templatePageContent(DEFAULT_THEME_CONFIG, "account").pack).toBe("image-left");
  });
});

describe("Popup layouts (Phase 3 fourth option)", () => {
  it("includes corner as the fourth layout", () => {
    expect(POPUP_LAYOUTS).toEqual(["center", "image-left", "bottom-bar", "corner"]);
    const p = popupSchema.parse({ id: "ucorner001", name: "Corner", layout: "corner" });
    expect(p.layout).toBe("corner");
    expect(popupSchema.safeParse({ id: "ubadlay001", name: "Bad", layout: "fullscreen" }).success).toBe(false);
  });
});
