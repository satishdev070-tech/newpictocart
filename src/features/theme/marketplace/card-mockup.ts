import { layoutSummary } from "../layouts/apply-layout";
import type { ThemePreset } from "./types";

/**
 * Slim payload shipped on marketplace catalogue cards. Full presets (home composition, seeds,
 * collection/product pages) stay on the server for apply + detail; cards only need enough for
 * ThemeMockup / InformativeThemeMockup fallbacks and the card background colour.
 */
export type MarketplaceCardMockup = {
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  headingCase?: string;
  cardRadius?: string;
  buttonShape?: string;
  buttonVariant?: string;
  headerLayout: "logo-left" | "logo-center";
  productCard: { imageRatio?: unknown; textAlign?: unknown; badgeStyle?: unknown };
  footerTone: "dark" | "light" | "muted";
  announcementTone: string;
  family?: string;
  heroAlign: string;
  layout: { hero: string; products: string; headerStyle: string; footerLayout: string };
};

export function toMarketplaceCardMockup(preset: ThemePreset): MarketplaceCardMockup {
  const t = preset.tokens;
  return {
    colors: t.colors,
    headingFont: t.headingFont,
    bodyFont: t.bodyFont,
    headingCase: typeof t.headingCase === "string" ? t.headingCase : undefined,
    cardRadius: typeof t.cardRadius === "string" ? t.cardRadius : undefined,
    buttonShape: typeof t.buttonShape === "string" ? t.buttonShape : undefined,
    buttonVariant: typeof t.buttonVariant === "string" ? t.buttonVariant : undefined,
    headerLayout: preset.headerLayout,
    productCard: {
      imageRatio: preset.productCard.imageRatio,
      textAlign: preset.productCard.textAlign,
      badgeStyle: preset.productCard.badgeStyle,
    },
    footerTone: preset.footerTone,
    announcementTone: preset.announcementTone,
    family: preset.family,
    heroAlign: preset.hero.align,
    layout: layoutSummary(preset),
  };
}

/** Rebuild a ThemePreset-shaped object for ThemeMockup / InformativeThemeMockup. */
export function mockupAsPreset(m: MarketplaceCardMockup): ThemePreset {
  return {
    tokens: {
      colors: m.colors,
      headingFont: m.headingFont,
      bodyFont: m.bodyFont,
      ...(m.headingCase ? { headingCase: m.headingCase } : {}),
      ...(m.cardRadius ? { cardRadius: m.cardRadius } : {}),
      ...(m.buttonShape ? { buttonShape: m.buttonShape } : {}),
      ...(m.buttonVariant ? { buttonVariant: m.buttonVariant } : {}),
    },
    header: {},
    headerLayout: m.headerLayout,
    productCard: m.productCard,
    footerTone: m.footerTone,
    announcementTone: m.announcementTone,
    inlineMenu: false,
    hero: { align: m.heroAlign, textTone: "light" },
    home: [
      ["Hero", { variant: m.layout.hero }],
      ["ProductGrid", { variant: m.layout.products }],
    ],
    family: m.family,
    headerStyle: m.layout.headerStyle as ThemePreset["headerStyle"],
    footerLayout: m.layout.footerLayout as ThemePreset["footerLayout"],
  };
}
