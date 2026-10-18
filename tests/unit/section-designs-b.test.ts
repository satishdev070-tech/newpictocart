import { describe, expect, it } from "vitest";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import type { EditorField, SectionType } from "@/features/theme/sections/types";
import { DIAGRAMS } from "@/features/theme/site-builder/components/fields";
import { DIAGRAMS_B } from "@/features/theme/site-builder/variant-diagrams-b";

/**
 * Section designs, group b: every section in this group offers at least three layouts in the
 * builder's "Change design" tab, each with a wireframe, and themes saved before the designs
 * existed (no variant key) still get today's look (the first option).
 */

/** Group b sections and the setting each one's design picker writes. */
const GROUP_B: Partial<Record<SectionType, string>> = {
  AnnouncementBar: "variant",
  MegaMenu: "variant",
  CollectionGrid: "layout",
  ProductCarousel: "variant",
  ProductGrid: "variant",
  Bestseller: "layout",
  NewArrivals: "layout",
  SaleBanner: "variant",
  EditorialImageText: "variant",
  VideoBanner: "variant",
  Lookbook: "layout",
  BrandStory: "variant",
  Testimonials: "variant",
  Reviews: "variant",
  Newsletter: "variant",
  TrustBadges: "layout",
  Marquee: "variant",
  BrandStrip: "layout",
  VideoShop: "layout",
  ProductSpotlight: "variant",
  CompactProducts: "variant",
  FeatureBand: "variant",
  DecorDivider: "layout",
};

/** The look each section had before designs existed (the default must not change). */
const LEGACY_DEFAULT: Partial<Record<SectionType, string>> = {
  AnnouncementBar: "announce-bar",
  MegaMenu: "mega-dropdown",
  CollectionGrid: "grid",
  ProductCarousel: "cards",
  ProductGrid: "grid",
  Bestseller: "grid",
  NewArrivals: "carousel",
  SaleBanner: "sale-band",
  EditorialImageText: "split",
  VideoBanner: "video-boxed",
  Lookbook: "masonry",
  BrandStory: "split",
  Testimonials: "grid",
  Reviews: "reviews-carousel",
  Newsletter: "centered",
  TrustBadges: "grid",
  Marquee: "marquee-strip",
  BrandStrip: "row",
  VideoShop: "cards",
  ProductSpotlight: "spotlight-switcher",
  CompactProducts: "compact-grid",
  FeatureBand: "band-feature",
  DecorDivider: "divider",
};

type Select = Extract<EditorField, { kind: "select" }>;
const picker = (type: SectionType): Select | undefined => {
  const key = GROUP_B[type];
  return (SECTION_DEFINITIONS[type].fields as EditorField[]).find((f): f is Select => f.kind === "select" && f.display === "variants" && f.key === key);
};
const entries = Object.entries(GROUP_B) as [SectionType, string][];

describe("section designs (group b)", () => {
  it("offers at least three designs per section in the Change design tab", () => {
    for (const [type] of entries) {
      const f = picker(type);
      expect(f, `${type} design picker`).toBeDefined();
      expect(f!.options.length, type).toBeGreaterThanOrEqual(3);
      expect(new Set(f!.options.map((o) => o.value)).size, `${type} unique values`).toBe(f!.options.length);
      for (const o of f!.options) expect(o.label.length, `${type}.${o.value} label`).toBeGreaterThan(0);
    }
  });

  it("keeps the old look as the default (first option) and for settings saved without a design", () => {
    for (const [type, key] of entries) {
      const defaults = defaultSettings(type);
      expect(defaults[key], type).toBe(LEGACY_DEFAULT[type]);
      // Bestseller shares the "carousel first" option list with NewArrivals but has always defaulted to grid.
      if (type === "Bestseller") expect(picker(type)!.options.map((o) => o.value)).toContain("grid");
      else expect(picker(type)!.options[0]!.value, type).toBe(LEGACY_DEFAULT[type]);
      expect(SECTION_DEFINITIONS[type].schema.safeParse(defaults).success, type).toBe(true);
      // An old saved section: no design key at all.
      const old = { ...defaults };
      delete old[key];
      const parsed = SECTION_DEFINITIONS[type].schema.parse(old) as Record<string, unknown>;
      expect(parsed[key], `${type} legacy`).toBe(LEGACY_DEFAULT[type]);
    }
  });

  it("accepts every offered design and rejects unknown ones", () => {
    for (const [type, key] of entries) {
      for (const o of picker(type)!.options) expect(SECTION_DEFINITIONS[type].schema.safeParse({ [key]: o.value }).success, `${type}.${o.value}`).toBe(true);
      expect(SECTION_DEFINITIONS[type].schema.safeParse({ [key]: "<b>x</b>" }).success, type).toBe(false);
    }
  });

  it("has a wireframe for every design", () => {
    for (const [type] of entries) {
      for (const o of picker(type)!.options) expect(DIAGRAMS[o.value] ?? DIAGRAMS_B[o.value], `${type}.${o.value} diagram`).toBeDefined();
    }
  });

  it("only shows design-specific settings for the designs that use them", () => {
    const showIf = (type: SectionType, key: string) => (SECTION_DEFINITIONS[type].fields as EditorField[]).find((f) => f.key === key)?.showIf;
    expect(showIf("AnnouncementBar", "mode")).toEqual({ key: "variant", equals: ["announce-bar"] });
    expect(showIf("VideoBanner", "videoPosition")).toEqual({ key: "variant", equals: ["video-split"] });
    expect(showIf("ProductCarousel", "dragLabel")?.equals).toEqual(["tilt"]);
    expect(showIf("DecorDivider", "artwork")?.equals).toEqual(["divider"]);
    expect(showIf("ProductSpotlight", "swatchLabel")?.equals).not.toContain("spotlight-rows");
  });
});
