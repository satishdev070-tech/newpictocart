import { createElement, type ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";
import type { EditorField } from "@/features/theme/sections/types";
import { sectionTabs, visibleFields } from "@/features/theme/site-builder/field-groups";
import { curatedStockSet, pickStock } from "@/lib/unsplash-stock";

/**
 * Multi-photo designs: the Hero "Editorial collage" (three photos) and the BrandStory "Collage" (two
 * photos) expose every visible photo as an editable image field. Old documents keep working: empty
 * slots fall back to the older source (later slides) and then to a stock photo.
 */

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxxxxxx");
vi.stubEnv("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN", "pictocart.in");

const T = "tenant/11111111-1111-4111-8111-111111111111/media";
const IMG1 = `${T}/one.jpg`;
const IMG2 = `${T}/two.jpg`;
const IMG3 = `${T}/three.jpg`;
const stock = curatedStockSet("fashion");
const stockId = (slot: "hero" | "story", n: number) => pickStock(stock, slot, n)!.id;

const hero = SECTION_DEFINITIONS.Hero;
const story = SECTION_DEFINITIONS.BrandStory;

let HeroVariant: typeof import("@/features/theme/render/variants").HeroVariant;
let StoryVariant: typeof import("@/features/theme/render/variants").StoryVariant;
beforeAll(async () => {
  ({ HeroVariant, StoryVariant } = await import("@/features/theme/render/variants"));
});

const ctx = { stock, stockProducts: false } as never;

async function render(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node, { onError: (e) => { throw e; } });
  let html = "";
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

/** The collage cells' HTML, in order (the credit line follows them). */
const cells = (html: string, cls: string) => html.split(`class="${cls}-`).slice(1);

describe("Hero collage photos: schema", () => {
  it("old documents parse with empty extra photo slots", () => {
    const old = hero.schema.parse({ variant: "collage", slides: [{ imagePath: IMG1, heading: "Hi" }] });
    expect(old).toMatchObject({ image2Path: "", image2Alt: "", image3Path: "", image3Alt: "" });
    expect(defaultSettings("Hero")).toMatchObject({ image2Path: "", image3Path: "" });
  });

  it("accepts tenant asset paths and rejects anything else", () => {
    expect(hero.schema.safeParse({ image2Path: IMG2, image3Path: IMG3, image2Alt: "Serum", image3Alt: "Face" }).success).toBe(true);
    for (const bad of ["https://evil.example/x.jpg", "/x.jpg", "tenant/not-a-uuid/media/x.jpg", "javascript:alert(1)"]) {
      expect(hero.schema.safeParse({ image2Path: bad }).success, bad).toBe(false);
      expect(hero.schema.safeParse({ image3Path: bad }).success, bad).toBe(false);
      expect(story.schema.safeParse({ image2Path: bad }).success, bad).toBe(false);
    }
    expect(hero.schema.safeParse({ image2Alt: "x".repeat(201) }).success).toBe(false);
  });

  it("BrandStory keeps parsing old documents and accepts a second photo", () => {
    expect(story.schema.parse({ variant: "collage" })).toMatchObject({ image2Path: "", image2Alt: "" });
    expect(story.schema.safeParse({ variant: "collage", image2Path: IMG2, image2Alt: "Loom" }).success).toBe(true);
  });
});

describe("Hero collage photos: editor fields", () => {
  const keys = (fields: readonly EditorField[], values: Record<string, unknown>) => visibleFields(fields, values).map((f) => f.key);

  it("shows photo 2 and 3 (image pickers) on the Edit tab only for the collage design", () => {
    const edit = sectionTabs(hero).edit;
    const extra = edit.filter((f) => ["image2Path", "image3Path"].includes(f.key));
    expect(extra.map((f) => f.kind)).toEqual(["image", "image"]);
    expect(keys(edit, { variant: "collage" })).toEqual(expect.arrayContaining(["image2Path", "image2Alt", "image3Path", "image3Alt"]));
    for (const variant of ["overlay", "split", "minimal", "band", "cards", "framed", "hero-fade", "hero-slider", "hero-kenburns"]) {
      expect(keys(edit, { variant }).filter((k) => /^image[23]/.test(k)), variant).toEqual([]);
    }
  });

  it("shows the BrandStory second photo only for its collage design", () => {
    const edit = sectionTabs(story).edit;
    expect(edit.find((f) => f.key === "image2Path")?.kind).toBe("image");
    expect(keys(edit, { variant: "collage" })).toContain("image2Path");
    expect(keys(edit, { variant: "split" })).not.toContain("image2Path");
  });
});

describe("Hero collage photos: render", () => {
  const heroSettings = (extra: Record<string, unknown>) => hero.schema.parse({ variant: "collage", slides: [{ imagePath: IMG1, alt: "Cream", heading: "Welcome" }], ...extra });

  it("renders the chosen photos 2 and 3", async () => {
    const html = await render(createElement(HeroVariant, { s: heroSettings({ image2Path: IMG2, image2Alt: "Serum", image3Path: IMG3, image3Alt: "Face" }), ctx }));
    const [c1, c2, c3] = cells(html, "sf-hero-collage");
    expect(c1).toContain("one.jpg");
    expect(c2).toContain("two.jpg");
    expect(c2).toContain('alt="Serum"');
    expect(c3).toContain("three.jpg");
    expect(c3).toContain('alt="Face"');
    expect(html).not.toContain("photo-credit");
  });

  it("falls back to stock photos when the slots are empty", async () => {
    const html = await render(createElement(HeroVariant, { s: heroSettings({}), ctx }));
    const [c1, c2, c3] = cells(html, "sf-hero-collage");
    expect(c1).toContain("one.jpg");
    expect(c2).toContain(stockId("hero", 1));
    expect(c3).toContain(stockId("hero", 2));
    // The stock photos are credited even when photo 1 is the seller's own.
    expect(html).toContain("sf-photo-credit");
  });

  it("mixes a chosen photo with a stock one", async () => {
    const html = await render(createElement(HeroVariant, { s: heroSettings({ image3Path: IMG3 }), ctx }));
    const [, c2, c3] = cells(html, "sf-hero-collage");
    expect(c2).toContain(stockId("hero", 1));
    expect(c3).toContain("three.jpg");
  });

  it("older documents that filled the collage from slides 2 and 3 still show those photos", async () => {
    const s = hero.schema.parse({ variant: "collage", slides: [{ imagePath: IMG1 }, { imagePath: IMG2, alt: "Second" }, { imagePath: IMG3 }] });
    const html = await render(createElement(HeroVariant, { s, ctx }));
    const [, c2, c3] = cells(html, "sf-hero-collage");
    expect(c2).toContain("two.jpg");
    expect(c2).toContain('alt="Second"');
    expect(c3).toContain("three.jpg");
  });

  it("the explicit photo wins over a later slide's image", async () => {
    const s = hero.schema.parse({ variant: "collage", slides: [{ imagePath: IMG1 }, { imagePath: IMG3 }], image2Path: IMG2 });
    const [, c2] = cells(await render(createElement(HeroVariant, { s, ctx })), "sf-hero-collage");
    expect(c2).toContain("two.jpg");
    expect(c2).not.toContain("three.jpg");
  });
});

describe("BrandStory collage second photo: render", () => {
  it("renders the chosen second photo, else a stock one", async () => {
    const chosen = await render(createElement(StoryVariant, { s: story.schema.parse({ variant: "collage", imagePath: IMG1, image2Path: IMG2, image2Alt: "Loom" }), ctx }));
    const second = chosen.split("sf-story-collage-2")[1]!;
    expect(second).toContain("two.jpg");
    expect(second).toContain('alt="Loom"');

    const empty = await render(createElement(StoryVariant, { s: story.schema.parse({ variant: "collage", imagePath: IMG1 }), ctx }));
    expect(empty.split("sf-story-collage-2")[1]).toContain(stockId("story", 1));
    expect(empty).toContain("sf-photo-credit");
  });
});
