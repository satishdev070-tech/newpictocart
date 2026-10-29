import { createElement, type ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import { isGroupShown, itemGroups, setGroupVisible } from "@/features/theme/site-builder/field-groups";
import { slideGroups } from "@/features/theme/render/slide-visibility";
import { curatedStockSet } from "@/lib/unsplash-stock";

/**
 * Phase A1: Hero item-group Off must hide without deleting merchant content; On restores the same
 * strings/media. Renderer paths (slideshow + classic layouts) respect show* flags.
 * Phase F: shared-helper parity (isGroupShown ↔ slideGroups) + subtitle Off/On.
 */

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxxxxxx");
vi.stubEnv("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN", "pictocart.in");

const T = "tenant/11111111-1111-4111-8111-111111111111/media";
const IMG = `${T}/hero.jpg`;
const stock = curatedStockSet("fashion");
const ctx = { stock, stockProducts: false } as never;

let HeroDesign: typeof import("@/features/theme/render/designs-a").HeroDesign;
let HeroVariant: typeof import("@/features/theme/render/variants").HeroVariant;

beforeAll(async () => {
  ({ HeroDesign } = await import("@/features/theme/render/designs-a"));
  ({ HeroVariant } = await import("@/features/theme/render/variants"));
});

async function render(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node, {
    onError: (e) => {
      throw e;
    },
  });
  let html = "";
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

const baseSlide = {
  imagePath: IMG,
  mobileImagePath: "",
  alt: "Hero photo",
  eyebrow: "New season",
  heading: "The festive edit",
  headingAccent: "a saree.",
  subheading: "Hand block printed in Jaipur",
  ctaLabel: "Shop now",
  ctaHref: "/collections",
  align: "left" as const,
  textTone: "light" as const,
};

describe("Hero slide group visibility helpers", () => {
  it("Off→On round-trips strings and media on the slide", () => {
    const list = SECTION_DEFINITIONS.Hero.fields.find((f) => f.kind === "list" && f.key === "slides");
    if (!list || list.kind !== "list") throw new Error("Hero slides list field missing");
    const groups = itemGroups(list.fields);
    let item: Record<string, unknown> = { ...baseSlide };

    for (const id of ["title", "description", "media", "actions"] as const) {
      const g = groups.find((x) => x.id === id)!;
      item = setGroupVisible(g, item, false);
    }
    expect(item.heading).toBe(baseSlide.heading);
    expect(item.subheading).toBe(baseSlide.subheading);
    expect(item.imagePath).toBe(IMG);
    expect(item.ctaLabel).toBe(baseSlide.ctaLabel);
    expect(slideGroups(item).title).toBe(false);
    expect(slideGroups(item).media).toBe(false);

    for (const id of ["title", "description", "media", "actions"] as const) {
      const g = groups.find((x) => x.id === id)!;
      item = setGroupVisible(g, item, true);
    }
    expect(item).toMatchObject({
      heading: baseSlide.heading,
      subheading: baseSlide.subheading,
      imagePath: IMG,
      ctaLabel: baseSlide.ctaLabel,
      showTitle: true,
      showDescription: true,
      showMedia: true,
      showActions: true,
    });
    expect(slideGroups(item).title).toBe(true);
  });

  it("Subtitle Off/On keeps eyebrow and stays aligned with isGroupShown / slideGroups", () => {
    const list = SECTION_DEFINITIONS.Hero.fields.find((f) => f.kind === "list" && f.key === "slides");
    if (!list || list.kind !== "list") throw new Error("Hero slides list field missing");
    const subtitle = itemGroups(list.fields).find((g) => g.id === "subtitle");
    expect(subtitle).toBeTruthy();
    let item: Record<string, unknown> = { ...baseSlide };
    item = setGroupVisible(subtitle!, item, false);
    expect(item.eyebrow).toBe(baseSlide.eyebrow);
    expect(item.showSubtitle).toBe(false);
    expect(isGroupShown("subtitle", item)).toBe(false);
    expect(slideGroups(item).subtitle).toBe(false);

    item = setGroupVisible(subtitle!, item, true);
    expect(item.eyebrow).toBe(baseSlide.eyebrow);
    expect(item.showSubtitle).toBe(true);
    expect(isGroupShown("subtitle", item)).toBe(true);
    expect(slideGroups(item).subtitle).toBe(true);
  });

  it("isGroupShown and slideGroups agree for omitted and explicit flags", () => {
    const omitted = { ...baseSlide };
    expect(isGroupShown("title", omitted)).toBe(true);
    expect(slideGroups(omitted).title).toBe(true);
    const hidden = { ...baseSlide, showTitle: false, showMedia: false };
    expect(isGroupShown("title", hidden)).toBe(slideGroups(hidden).title);
    expect(isGroupShown("media", hidden)).toBe(slideGroups(hidden).media);
    expect(slideGroups(hidden)).toMatchObject({ title: false, media: false, description: true, actions: true, subtitle: true });
  });
});

describe("Hero renderer respects hidden groups", () => {
  it("slideshow still renders with title/description/media/actions hidden (content kept in settings)", async () => {
    const slide = SECTION_DEFINITIONS.Hero.schema.parse({
      variant: "hero-fade",
      slides: [{ ...baseSlide, showTitle: false, showDescription: false, showMedia: false, showActions: false, showSubtitle: false }],
    }).slides[0]!;
    expect(slide.heading).toBe(baseSlide.heading);
    expect(slide.imagePath).toBe(IMG);

    const s = SECTION_DEFINITIONS.Hero.schema.parse({
      variant: "hero-fade",
      height: "large",
      overlay: 25,
      autoplay: 0,
      slides: [slide],
    });
    const html = await render(createElement(HeroDesign, { s, ctx, variant: "hero-fade" }));
    expect(html).toContain("sf-stage");
    expect(html).not.toContain(baseSlide.heading);
    expect(html).not.toContain(baseSlide.subheading);
    expect(html).not.toContain(baseSlide.eyebrow);
    expect(html).not.toContain(baseSlide.ctaLabel);
    // Media group off: no store image for the slide path in the stage body (thumbs may still reference it).
    expect(html.includes(baseSlide.heading)).toBe(false);
  });

  it("split layout hides title and media when show* is false but keeps them in the parsed slide", async () => {
    const s = SECTION_DEFINITIONS.Hero.schema.parse({
      variant: "split",
      panelTone: "muted",
      slides: [{ ...baseSlide, showTitle: false, showMedia: false }],
    });
    expect(s.slides[0]!.heading).toBe(baseSlide.heading);
    expect(s.slides[0]!.imagePath).toBe(IMG);
    const html = await render(createElement(HeroVariant, { s, ctx }));
    expect(html).toContain("sf-hero-split");
    expect(html).not.toContain(baseSlide.heading);
    expect(html).toContain(baseSlide.subheading);
    expect(html).toContain(baseSlide.ctaLabel);
  });
});
