import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_KEYS, FONT_STACKS, LOGO_LIMITS, headerSettingsSchema, tokensSchema } from "@/features/theme/schema/tokens";
import { AUTO_LOGO_HEIGHT, hasCustomLogoPosition, hasCustomLogoSize, logoImageProps, resolveLogoPositions, splitMenu } from "@/features/theme/render/logo-layout";

const OLD_HEADER = { logoPath: "", logoAlt: "", logoMaxWidth: 200, menuHandle: "main", showSearch: true, showAccount: true, showWishlist: true, showCart: true, sticky: true };

describe("header logo settings", () => {
  it("parses old header settings with the new fields at their back-compatible defaults", () => {
    const h = headerSettingsSchema.parse(OLD_HEADER);
    expect(h).toMatchObject({ logoMaxWidth: 200, logoWidth: 0, logoWidthMobile: 0, logoHeight: 0, logoHeightMobile: 0, logoPosition: "auto", mobileLogoPosition: "auto", menuFontSize: 0, menuFontWeight: "default", menuLetterSpacing: "default", menuTextCase: "default", menuTextColor: "" });
    expect(headerSettingsSchema.parse({})).toMatchObject({ logoMaxWidth: 160, logoWidth: 0, logoPosition: "auto", mobileLogoPosition: "auto" });
    expect(hasCustomLogoSize(h)).toBe(false);
    expect(hasCustomLogoPosition(h)).toBe(false);
  });

  it("keeps the exact legacy logo style while no size is set", () => {
    const h = headerSettingsSchema.parse(OLD_HEADER);
    const positions = resolveLogoPositions(h, "logo-left");
    expect(logoImageProps(h, { aspectRatio: "4 / 1", legacyMaxHeight: 56, positions })).toEqual({ className: "h-auto w-auto", style: { maxWidth: 200, maxHeight: 56, aspectRatio: "4 / 1" } });
  });

  it("drives an exact width per breakpoint once a size is set", () => {
    const h = headerSettingsSchema.parse({ ...OLD_HEADER, logoWidth: 300, logoHeightMobile: 40 });
    const { className, style } = logoImageProps(h, { legacyMaxHeight: 56, positions: { desktop: "center", mobile: "left" } });
    expect(className).toBe("sf-logo-img");
    expect(style).toMatchObject({
      "--sf-logo-w": "300px",
      "--sf-logo-w-m": "min(300px, 40cqi)",
      "--sf-logo-h": `${AUTO_LOGO_HEIGHT.desktop}px`,
      "--sf-logo-h-m": "40px",
      "--sf-logo-pos": "center",
      "--sf-logo-pos-m": "left center",
    });
  });

  it("validates the new ranges (0 = auto)", () => {
    for (const [key, lim] of [["logoWidth", LOGO_LIMITS.width], ["logoWidthMobile", LOGO_LIMITS.widthMobile], ["logoHeight", LOGO_LIMITS.height], ["logoHeightMobile", LOGO_LIMITS.heightMobile]] as const) {
      expect(headerSettingsSchema.safeParse({ [key]: 0 }).success).toBe(true);
      expect(headerSettingsSchema.safeParse({ [key]: lim.min }).success).toBe(true);
      expect(headerSettingsSchema.safeParse({ [key]: lim.max }).success).toBe(true);
      expect(headerSettingsSchema.safeParse({ [key]: lim.min - 1 }).success).toBe(false);
      expect(headerSettingsSchema.safeParse({ [key]: lim.max + 1 }).success).toBe(false);
      expect(headerSettingsSchema.safeParse({ [key]: -5 }).success).toBe(false);
    }
    expect(headerSettingsSchema.safeParse({ logoPosition: "center-stacked", mobileLogoPosition: "center" }).success).toBe(true);
    expect(headerSettingsSchema.safeParse({ logoPosition: "middle" }).success).toBe(false);
    expect(headerSettingsSchema.safeParse({ mobileLogoPosition: "right" }).success).toBe(false);
    expect(headerSettingsSchema.safeParse({ menuFontSize: 12, menuFontWeight: "700", menuLetterSpacing: "wide", menuTextCase: "uppercase", menuTextColor: "#112233" }).success).toBe(true);
    expect(headerSettingsSchema.safeParse({ menuFontSize: 25 }).success).toBe(false);
    expect(headerSettingsSchema.safeParse({ menuTextColor: "red" }).success).toBe(false);
  });

  it("resolves auto positions from the Header section layout", () => {
    const h = headerSettingsSchema.parse({});
    expect(resolveLogoPositions(h, "logo-center")).toEqual({ desktop: "center-stacked", mobile: "center" });
    expect(resolveLogoPositions(h, "logo-left")).toEqual({ desktop: "left", mobile: "left" });
    expect(resolveLogoPositions(h, "logo-left-nav-center")).toEqual({ desktop: "left", mobile: "left" });
    expect(resolveLogoPositions({ ...h, logoPosition: "right", mobileLogoPosition: "center" }, "logo-left")).toEqual({ desktop: "right", mobile: "center" });
  });

  it("splits the menu around a centred logo (first half on the left)", () => {
    expect(splitMenu([1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [4, 5]]);
    expect(splitMenu([])).toEqual([[], []]);
  });
});

describe("theme fonts", () => {
  const fontFiles = ["src/app/storefront-fonts.ts", "src/app/fonts.ts"].map((f) => readFileSync(path.join(process.cwd(), f), "utf8")).join("\n");

  it("every FONT_STACKS key has a label and a stack, and is selectable", () => {
    expect(FONT_KEYS.length).toBe(Object.keys(FONT_STACKS).length);
    for (const k of FONT_KEYS) {
      expect(FONT_STACKS[k].label.length).toBeGreaterThan(0);
      expect(FONT_STACKS[k].stack).toMatch(/(sans-serif|serif|monospace)$/);
      expect(tokensSchema.parse({ headingFont: k, bodyFont: k })).toMatchObject({ headingFont: k, bodyFont: k });
    }
  });

  it("includes the requested fonts", () => {
    const names = FONT_KEYS.map((k) => FONT_STACKS[k].label.split(" (")[0]);
    for (const n of ["Asap Sharp", "Open Sans", "Arimo", "Roboto Condensed", "Roboto", "DM Sans", "Isometra", "Rubik", "Playfair Display", "Outfit", "Poppins", "Montserrat"]) expect(names).toContain(n);
  });

  it("every font variable a stack uses is declared as a self-hosted font", () => {
    for (const k of FONT_KEYS) {
      for (const [, v] of FONT_STACKS[k].stack.matchAll(/var\((--font-[a-z0-9-]+)\)/g)) expect(fontFiles).toContain(`variable: "${v}"`);
    }
  });

  it("old tokens keep their fonts", () => {
    expect(tokensSchema.parse({})).toMatchObject({ headingFont: "editorial-serif", bodyFont: "modern-sans" });
  });
});
