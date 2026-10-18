import { describe, expect, it } from "vitest";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import { CATEGORY_VARIANTS, FAQ_VARIANTS, FOOTER_LAYOUTS, HERO_VARIANTS, PROMO_VARIANTS, SOCIAL_VARIANTS, type VariantOption } from "@/features/theme/sections/variants";
import type { EditorField } from "@/features/theme/sections/types";
import { DIAGRAMS_A } from "@/features/theme/site-builder/variant-diagrams-a";
import { parseInstagramMedia } from "@/features/social/server/instagram-feed";

/** Section designs, group a: FAQ, PromoBanner, Footer, Hero, CategoryGrid, SocialProof. */
const CASES: { type: keyof typeof SECTION_DEFINITIONS; key: string; list: readonly VariantOption[]; min: number; first: string; before: string[] }[] = [
  { type: "FAQ", key: "variant", list: FAQ_VARIANTS, min: 4, first: "accordion", before: [] },
  { type: "PromoBanner", key: "variant", list: PROMO_VARIANTS, min: 6, first: "tiles", before: [] },
  { type: "Footer", key: "layout", list: FOOTER_LAYOUTS, min: 9, first: "columns", before: ["columns", "centered", "minimal", "statement"] },
  { type: "Hero", key: "variant", list: HERO_VARIANTS, min: 10, first: "overlay", before: ["overlay", "split", "collage", "minimal", "band", "cards", "framed"] },
  { type: "CategoryGrid", key: "variant", list: CATEGORY_VARIANTS, min: 9, first: "grid", before: ["grid", "mosaic", "rail", "index", "pills"] },
  { type: "SocialProof", key: "layout", list: SOCIAL_VARIANTS, min: 3, first: "grid", before: ["grid", "mosaic", "strip"] },
];

/** Values that already had a wireframe in the site builder's built-in DIAGRAMS map. */
const BUILT_IN_DIAGRAMS = new Set(["overlay", "split", "collage", "minimal", "band", "cards", "framed", "grid", "mosaic", "rail", "index", "pills", "columns", "centered", "statement"]);

describe("section designs (group a)", () => {
  it.each(CASES)("$type has enough designs and keeps its old default", ({ type, key, list, min, first, before }) => {
    const values = list.map((o) => o.value);
    expect(values.length).toBeGreaterThanOrEqual(min);
    expect(values[0]).toBe(first);
    expect(new Set(values).size).toBe(values.length);
    for (const v of before) expect(values).toContain(v);
    // Old themes (no value saved) render the old look.
    expect(defaultSettings(type as never)[key]).toBe(first);
    const schema = SECTION_DEFINITIONS[type].schema;
    for (const v of values) expect(schema.safeParse({ [key]: v }).success, `${type}.${key}=${v}`).toBe(true);
    expect(schema.safeParse({ [key]: "<b>x</b>" }).success).toBe(false);
  });

  it.each(CASES)("$type exposes its designs as a variant picker", ({ type, key, list }) => {
    const field = (SECTION_DEFINITIONS[type].fields as EditorField[]).find((f) => f.key === key);
    expect(field && field.kind === "select" && field.display === "variants").toBe(true);
    if (field?.kind === "select") expect(field.options.map((o) => o.value)).toEqual(list.map((o) => o.value));
  });

  it("has a wireframe diagram for every design value", () => {
    for (const { type, list } of CASES) {
      for (const { value } of list) {
        const boxes = DIAGRAMS_A[value] ?? (BUILT_IN_DIAGRAMS.has(value) ? [[0, 0, 1, 1]] : undefined);
        expect(boxes?.length, `${type}: diagram for ${value}`).toBeGreaterThan(0);
      }
    }
    for (const boxes of Object.values(DIAGRAMS_A)) for (const b of boxes) expect(b.slice(0, 4).every((n) => typeof n === "number" && Number.isFinite(n))).toBe(true);
  });

  it("keeps new settings defaulted (old saved sections parse unchanged)", () => {
    expect(defaultSettings("PromoBanner")).toMatchObject({ variant: "tiles", tone: "accent", align: "left", badge: "" });
    expect(defaultSettings("FAQ")).toMatchObject({ variant: "accordion", ctaLabel: "", ctaHref: "", spacing: "default" });
    expect(defaultSettings("Footer")).toMatchObject({ layout: "columns", decor: "none", imagePath: "", imageAlt: "" });
    expect(defaultSettings("Hero")).toMatchObject({ variant: "overlay", slideNav: "thumbs" });
    expect(defaultSettings("SocialProof")).toMatchObject({ layout: "grid", source: "posts", bio: "" });
    expect(SECTION_DEFINITIONS.Footer.schema.safeParse({ decor: "illustration" }).success).toBe(true);
    expect(SECTION_DEFINITIONS.Footer.schema.safeParse({ imagePath: "https://evil.example/x.png" }).success).toBe(false);
    expect(SECTION_DEFINITIONS.SocialProof.schema.safeParse({ source: "instagram" }).success).toBe(true);
    expect(SECTION_DEFINITIONS.PromoBanner.schema.safeParse({ badge: "x".repeat(25) }).success).toBe(false);
  });
});

describe("Instagram feed parsing", () => {
  it("keeps only https Instagram CDN media with instagram.com permalinks", () => {
    const media = parseInstagramMedia({
      data: [
        { id: "1", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/a.jpg", permalink: "https://www.instagram.com/p/abc/", caption: "New drop\nmore text" },
        { id: "2", media_type: "VIDEO", media_url: "https://video.cdninstagram.com/v.mp4", thumbnail_url: "https://scontent.fbcdn.net/t.jpg", permalink: "https://www.instagram.com/reel/x/" },
        { id: "3", media_type: "IMAGE", media_url: "https://evil.example/a.jpg", permalink: "https://www.instagram.com/p/def/" },
        { id: "4", media_type: "IMAGE", media_url: "javascript:alert(1)", permalink: "https://www.instagram.com/p/ghi/" },
        { id: "5", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/b.jpg", permalink: "https://evil.example/p/" },
        { id: "x6", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/c.jpg", permalink: "https://www.instagram.com/p/c/" },
      ],
    });
    expect(media).toEqual([
      { id: "1", imageUrl: "https://scontent.cdninstagram.com/a.jpg", permalink: "https://www.instagram.com/p/abc/", isVideo: false, caption: "New drop" },
      { id: "2", imageUrl: "https://scontent.fbcdn.net/t.jpg", permalink: "https://www.instagram.com/reel/x/", isVideo: true, caption: "" },
    ]);
    expect(parseInstagramMedia(null)).toEqual([]);
    expect(parseInstagramMedia({ data: "nope" })).toEqual([]);
  });
});
