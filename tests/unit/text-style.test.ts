import { describe, expect, it } from "vitest";
import {
  clampTextWidthPct,
  normalizeTextLook,
  parseTextLook,
  patchTextLook,
  textLookAttrs,
  textLookChanged,
  textLookFontFamily,
  textLookSchema,
  textLookStyle,
} from "@/features/theme/schema/text-style";
import { FONT_STACKS } from "@/features/theme/schema/tokens";
import { lookOf, textCurrentClass } from "@/features/theme/render/text-look";
import { SECTION_DEFINITIONS, defaultSettings } from "@/features/theme/sections/definitions";

describe("text look schema", () => {
  it("defaults every key so old themes parse unchanged", () => {
    expect(textLookSchema.parse({})).toEqual({
      font: "default",
      fontKey: "",
      weight: "default",
      size: 0,
      color: "",
      align: "default",
      bold: false,
      italic: false,
      underline: false,
      widthPct: 0,
    });
  });

  it("accepts a full override and normalises empty looks away", () => {
    const look = textLookSchema.parse({
      font: "heading",
      weight: "700",
      size: 48,
      color: "#1C1917",
      align: "center",
      bold: true,
      italic: true,
      underline: true,
      widthPct: 80,
    });
    expect(look.color).toBe("#1c1917");
    expect(normalizeTextLook(look)).toMatchObject({ font: "heading", size: 48, widthPct: 80, bold: true });
    expect(normalizeTextLook(textLookSchema.parse({}))).toBeUndefined();
    expect(textLookChanged(look)).toBe(true);
    expect(textLookChanged(undefined)).toBe(false);
  });

  it("accepts optional fontKey from FONT_STACKS and keeps old themes without it", () => {
    expect(textLookSchema.parse({ font: "body" }).fontKey).toBe("");
    const withKey = textLookSchema.parse({ fontKey: "hind", font: "default" });
    expect(withKey.fontKey).toBe("hind");
    expect(normalizeTextLook(withKey)).toMatchObject({ fontKey: "hind" });
    expect(parseTextLook({ fontKey: "not-a-font" }).error).toBeTruthy();
  });

  it("rejects unsafe colour / out-of-range values without throwing from parseTextLook", () => {
    expect(parseTextLook({ color: "red" }).error).toBeTruthy();
    expect(parseTextLook({ size: 200 }).error).toBeTruthy();
    expect(parseTextLook({ widthPct: 140 }).error).toBeTruthy();
    expect(parseTextLook({ font: "comic-sans" }).error).toBeTruthy();
    expect(parseTextLook(null)).toEqual({});
  });
});

describe("text look style helpers", () => {
  it("emits only overridden CSS properties and safe font vars", () => {
    expect(textLookStyle(undefined)).toBeUndefined();
    expect(textLookStyle(textLookSchema.parse({}))).toBeUndefined();
    const style = textLookStyle(
      textLookSchema.parse({ font: "heading", weight: "600", size: 40, color: "#111111", align: "right", italic: true, underline: true, widthPct: 70 }),
    );
    expect(style).toMatchObject({
      fontFamily: "var(--sf-font-heading)",
      fontWeight: 600,
      fontSize: "40px",
      color: "#111111",
      textAlign: "right",
      fontStyle: "italic",
      textDecorationLine: "underline",
      width: "70%",
      maxWidth: "100%",
    });
    expect(style?.["--pc-text-w" as keyof typeof style]).toBe("70%");
  });

  it("lets fontKey win over the heading/body role font", () => {
    const look = textLookSchema.parse({ font: "heading", fontKey: "noto-sans-devanagari" });
    expect(textLookFontFamily(look)).toBe(FONT_STACKS["noto-sans-devanagari"].stack);
    expect(textLookStyle(look)?.fontFamily).toBe(FONT_STACKS["noto-sans-devanagari"].stack);
    expect(textLookFontFamily(textLookSchema.parse({ font: "body" }))).toBe("var(--sf-font-body)");
  });

  it("lets bold win over weight and shrinks size on mobile", () => {
    const look = textLookSchema.parse({ bold: true, weight: "300", size: 50, widthPct: 30 });
    expect(textLookStyle(look)?.fontWeight).toBe(700);
    expect(textLookStyle(look, { device: "mobile" })?.fontSize).toBe("40px");
  });

  it("clamps phone text-box width to a readable floor and the column", () => {
    expect(clampTextWidthPct(0, "mobile")).toBe(0);
    expect(clampTextWidthPct(20, "mobile")).toBe(40);
    expect(clampTextWidthPct(85, "mobile")).toBe(85);
    expect(clampTextWidthPct(120, "desktop")).toBe(100);
  });

  it("builds canvas data attributes for selection / resize", () => {
    expect(textLookAttrs("heading", textLookSchema.parse({ widthPct: 55 }), 1)).toEqual({
      "data-pc-text": "heading",
      "data-pc-text-item": "1",
      "data-pc-text-width": "55",
    });
    expect(textLookAttrs("body", undefined)).toEqual({ "data-pc-text": "body" });
  });

  it("patches looks for the editor and canvas resize", () => {
    expect(patchTextLook({}, { widthPct: 60 }).widthPct).toBe(60);
    expect(patchTextLook({ font: "body", widthPct: 40 }, { widthPct: 25 })).toMatchObject({ font: "body", widthPct: 25 });
  });

  it("skips !text-current when a look colour is set so inline colour can win", () => {
    expect(textCurrentClass(undefined)).toBe("!text-current");
    expect(textCurrentClass(lookOf({}))).toBe("!text-current");
    expect(textCurrentClass(lookOf({ color: "" }))).toBe("!text-current");
    expect(textCurrentClass(lookOf({ color: "#1c1917" }))).toBe("");
  });
});

describe("section heading / CTA looks", () => {
  it("defaults empty looks on ProductGrid / BrandStory / FAQ so old themes parse", () => {
    const grid = defaultSettings("ProductGrid");
    expect(grid).toMatchObject({
      eyebrowLook: expect.objectContaining({ color: "" }),
      headingLook: expect.objectContaining({ color: "" }),
      subheadingLook: expect.objectContaining({ color: "" }),
    });
    const story = defaultSettings("BrandStory");
    expect(story).toMatchObject({
      bodyLook: expect.objectContaining({ color: "" }),
      ctaLook: expect.objectContaining({ color: "" }),
    });
    const faq = defaultSettings("FAQ");
    expect(faq).toMatchObject({ ctaLook: expect.objectContaining({ color: "" }) });
  });

  it("exposes TextStyleField rows next to heading and CTA copy", () => {
    const keys = (type: keyof typeof SECTION_DEFINITIONS) => SECTION_DEFINITIONS[type].fields.map((f) => f.key);
    expect(keys("ProductGrid")).toEqual(expect.arrayContaining(["eyebrowLook", "headingLook", "subheadingLook"]));
    expect(keys("BrandStory")).toEqual(expect.arrayContaining(["eyebrowLook", "headingLook", "subheadingLook", "bodyLook", "ctaLook"]));
    expect(keys("SaleBanner")).toEqual(expect.arrayContaining(["ctaLook"]));
    expect(keys("FAQ")).toEqual(expect.arrayContaining(["ctaLook"]));
    expect(keys("RichText")).toEqual(expect.arrayContaining(["eyebrowLook", "headingLook", "subheadingLook", "bodyLook", "ctaLook"]));
  });
});
