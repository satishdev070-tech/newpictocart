import { z } from "zod";
import { UNSPLASH_CATEGORIES } from "@/lib/unsplash-categories";
import { hexColor, imagePath, menuHandle, plainText } from "./primitives";
import { typographySchema } from "./site";

/**
 * Global design tokens, header settings and product-card settings. Every field has a default
 * so a partial/older config is completed on parse. Values are enumerations or validated hex
 * colours: the CSS emitted from them (ThemeTokensStyle) cannot contain seller-controlled text.
 */

/** Font picker language groups (English Latin stacks vs Hindi / Devanagari). */
export const FONT_GROUPS = ["english", "hindi"] as const;
export type FontGroup = (typeof FONT_GROUPS)[number];
export const FONT_GROUP_LABELS: Record<FontGroup, string> = { english: "English", hindi: "Hindi" };

/** Font stacks allowlist (ADR-019: no web-font downloads at build; system/self-hosted stacks only). */
export const FONT_STACKS = {
  "editorial-serif": { label: "Cormorant Garamond (editorial serif)", stack: 'var(--font-cormorant), "Iowan Old Style", Palatino, Georgia, serif', group: "english" },
  "classic-serif": { label: "Fraunces (soft serif)", stack: 'var(--font-fraunces), ui-serif, Georgia, serif', group: "english" },
  didone: { label: "Bodoni Moda (high contrast)", stack: 'var(--font-bodoni-ext), var(--font-bodoni), Didot, "Bodoni 72", Georgia, serif', group: "english" },
  playfair: { label: "Playfair Display (display serif)", stack: 'var(--font-playfair), Georgia, serif', group: "english" },
  marcellus: { label: "Marcellus (classic capitals)", stack: 'var(--font-marcellus), "Trajan Pro", Georgia, serif', group: "english" },
  "modern-sans": { label: "Inter (modern sans)", stack: 'var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', group: "english" },
  "geometric-sans": { label: "Jost (geometric sans)", stack: 'var(--font-jost-ext), var(--font-jost), Avenir, "Century Gothic", sans-serif', group: "english" },
  "humanist-sans": { label: "Manrope (humanist sans)", stack: 'var(--font-manrope), Seravek, Ubuntu, Calibri, sans-serif', group: "english" },
  grotesk: { label: "Space Grotesk (bold grotesk)", stack: 'var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif', group: "english" },
  "dm-sans": { label: "DM Sans (clean sans)", stack: 'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif', group: "english" },
  condensed: { label: "Barlow Condensed (bold display)", stack: 'var(--font-barlow-condensed), "Arial Narrow", "Roboto Condensed", sans-serif', group: "english" },
  "asap-sharp": { label: "Asap Sharp (crisp sans)", stack: 'var(--font-asap-sharp), ui-sans-serif, system-ui, sans-serif', group: "english" },
  "open-sans": { label: "Open Sans (friendly sans)", stack: 'var(--font-open-sans), ui-sans-serif, system-ui, "Segoe UI", sans-serif', group: "english" },
  arimo: { label: "Arimo (neutral sans)", stack: 'var(--font-arimo), Arial, Helvetica, sans-serif', group: "english" },
  "roboto-condensed": { label: "Roboto Condensed (narrow sans)", stack: 'var(--font-roboto-condensed), "Arial Narrow", sans-serif', group: "english" },
  roboto: { label: "Roboto (everyday sans)", stack: 'var(--font-roboto), ui-sans-serif, system-ui, sans-serif', group: "english" },
  isometra: { label: "Isometra (geometric display)", stack: 'var(--font-isometra), "Century Gothic", ui-sans-serif, sans-serif', group: "english" },
  rubik: { label: "Rubik (rounded sans)", stack: 'var(--font-rubik), ui-sans-serif, system-ui, sans-serif', group: "english" },
  outfit: { label: "Outfit (geometric sans)", stack: 'var(--font-outfit), Avenir, ui-sans-serif, sans-serif', group: "english" },
  poppins: { label: "Poppins (geometric sans)", stack: 'var(--font-poppins), Avenir, ui-sans-serif, sans-serif', group: "english" },
  montserrat: { label: "Montserrat (urban sans)", stack: 'var(--font-montserrat), ui-sans-serif, system-ui, sans-serif', group: "english" },
  mono: { label: "Monospace", stack: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace', group: "english" },
  "noto-sans-devanagari": { label: "Noto Sans Devanagari (Hindi)", stack: 'var(--font-noto-sans-devanagari), "Noto Sans Devanagari", "Mangal", sans-serif', group: "hindi" },
  hind: { label: "Hind (Hindi)", stack: 'var(--font-hind), Hind, "Noto Sans Devanagari", Mangal, sans-serif', group: "hindi" },
} as const;
export type FontKey = keyof typeof FONT_STACKS;
export const FONT_KEYS = Object.keys(FONT_STACKS) as [FontKey, ...FontKey[]];

/** Font keys in a picker group (English vs Hindi), stable order of FONT_STACKS. */
export function fontKeysInGroup(group: FontGroup): FontKey[] {
  return FONT_KEYS.filter((k) => FONT_STACKS[k].group === group);
}

export const BUTTON_SHAPES = ["square", "rounded", "pill"] as const;
export const BUTTON_VARIANTS = ["solid", "outline"] as const;
export const CARD_RADII = ["none", "sm", "md", "lg"] as const;
export const CONTAINER_WIDTHS = ["narrow", "default", "wide", "full"] as const;
export const SPACING_SCALES = ["compact", "comfortable", "airy"] as const;

export const tokensSchema = z.object({
  colors: z
    .object({
      primary: hexColor.default("#1f1a17"),
      secondary: hexColor.default("#7a2e1f"),
      accent: hexColor.default("#b4532a"),
      background: hexColor.default("#fbf8f3"),
      text: hexColor.default("#1f1a17"),
      border: hexColor.default("#e6ded3"),
      sale: hexColor.default("#9f2a1c"),
    })
    .prefault({}),
  headingFont: z.enum(FONT_KEYS).default("editorial-serif"),
  bodyFont: z.enum(FONT_KEYS).default("modern-sans"),
  headingCase: z.enum(["normal", "uppercase"]).default("normal"),
  buttonShape: z.enum(BUTTON_SHAPES).default("square"),
  buttonVariant: z.enum(BUTTON_VARIANTS).default("solid"),
  cardRadius: z.enum(CARD_RADII).default("none"),
  containerWidth: z.enum(CONTAINER_WIDTHS).default("wide"),
  spacing: z.enum(SPACING_SCALES).default("airy"),
  /** Alignment of section titles (eyebrow, heading, subheading). */
  sectionHeadingAlign: z.enum(["left", "center"]).default("left"),
  /** "refined": opt-in polish for the editorial sections (type scale, spacing, hover states). */
  finish: z.enum(["standard", "refined"]).default("standard"),
  /**
   * Stock photos (Unsplash) for image slots the seller hasn't filled: "auto" uses the store's
   * category, a category name forces that category, "off" keeps plain placeholders.
   */
  imagery: z.enum(["auto", "off", ...UNSPLASH_CATEGORIES]).default("auto"),
  /** Per-level font sizes / weights set in the site builder (all "theme default" when absent). */
  typography: typographySchema,
});
export type ThemeTokens = z.infer<typeof tokensSchema>;

/** Logo size limits (px) for the builder sliders and the schema; 0 always means "auto". */
export const LOGO_LIMITS = {
  width: { min: 40, max: 400 },
  widthMobile: { min: 32, max: 280 },
  height: { min: 20, max: 200 },
  heightMobile: { min: 16, max: 120 },
} as const;
export const LOGO_POSITIONS = ["auto", "left", "center", "center-stacked", "right"] as const;
export const MOBILE_LOGO_POSITIONS = ["auto", "left", "center"] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];
export const LOGO_BADGE_BGS = ["none", "surface", "primary"] as const;
export type MobileLogoPosition = (typeof MOBILE_LOGO_POSITIONS)[number];
export const MENU_FONT_WEIGHTS = ["default", "400", "500", "600", "700", "800"] as const;
export const MENU_LETTER_SPACINGS = ["default", "tight", "normal", "wide", "wider"] as const;
export const MENU_TEXT_CASES = ["default", "normal", "uppercase"] as const;

function autoOrRange({ min, max }: { min: number; max: number }) {
  return z.coerce
    .number()
    .int()
    .refine((n) => n === 0 || (n >= min && n <= max), { message: `Use 0 (auto) or ${min}–${max}` })
    .default(0);
}

export const headerSettingsSchema = z.object({
  logoPath: imagePath.default(""),
  logoAlt: plainText(120).default(""),
  /** Legacy width cap; the logo is also capped at 56px tall (64px in the large-logo layout) while every size below is 0. */
  logoMaxWidth: z.coerce.number().int().min(60).max(320).default(160),
  /**
   * Exact logo widths / height limits (px) from the site builder; 0 = auto. While all four are 0
   * the logo renders exactly as before (logoMaxWidth + the fixed height cap).
   */
  logoWidth: autoOrRange(LOGO_LIMITS.width),
  logoWidthMobile: autoOrRange(LOGO_LIMITS.widthMobile),
  logoHeight: autoOrRange(LOGO_LIMITS.height),
  logoHeightMobile: autoOrRange(LOGO_LIMITS.heightMobile),
  /** Desktop logo placement; "auto" follows the Header section's layout (today's look). */
  logoPosition: z.enum(LOGO_POSITIONS).default("auto"),
  /** Phone/tablet logo placement; "auto" follows the Header section's layout. */
  mobileLogoPosition: z.enum(MOBILE_LOGO_POSITIONS).default("auto"),
  /** Tab behind the logo in the "Logo badge" header design: none (the logo file is the badge), white or brand colour. */
  logoBadgeBg: z.enum(LOGO_BADGE_BGS).default("none"),
  menuHandle: menuHandle.default("main"),
  /** Header menu typography. Defaults emit no additional CSS, preserving old themes. */
  menuFontSize: z.coerce.number().int().min(0).max(24).default(0),
  menuFontWeight: z.enum(MENU_FONT_WEIGHTS).default("default"),
  menuLetterSpacing: z.enum(MENU_LETTER_SPACINGS).default("default"),
  menuTextCase: z.enum(MENU_TEXT_CASES).default("default"),
  menuTextColor: z.union([hexColor, z.literal("")]).default(""),
  showSearch: z.boolean().default(true),
  showAccount: z.boolean().default(true),
  showWishlist: z.boolean().default(true),
  showCart: z.boolean().default(true),
  sticky: z.boolean().default(true),
  /** How the main menu appears on small screens. */
  mobileMenu: z.enum(["drawer", "fullscreen"]).default("drawer"),
  /** Show the store name as text when no logo is uploaded. */
  showStoreName: z.boolean().default(true),
  /** Text wordmark shown instead of the logo image (layout "logo-left-nav-center" only). Empty = logo image. */
  wordmark: plainText(40).default(""),
  /** Small spaced uppercase line under the logo (layout "logo-left-nav-center" only), e.g. "By Ayushi Paliya". */
  logoTagline: plainText(60).default(""),
  /** Fixed app-style bottom navigation on phones (Home, Search, Wishlist, Bag, Account, Orders). */
  bottomNav: z.boolean().default(false),
});
export type HeaderSettings = z.infer<typeof headerSettingsSchema>;

export const IMAGE_RATIOS = { portrait: "3 / 4", tall: "2 / 3", square: "1 / 1", landscape: "4 / 3" } as const;
export type ImageRatio = keyof typeof IMAGE_RATIOS;

export const productCardSchema = z.object({
  imageRatio: z.enum(["portrait", "tall", "square", "landscape"]).default("tall"),
  secondImageOnHover: z.boolean().default(true),
  showBadges: z.boolean().default(true),
  badgeStyle: z.enum(["minimal", "filled", "pill"]).default("minimal"),
  showComparePrice: z.boolean().default(true),
  showDiscountPercent: z.boolean().default(true),
  showQuickAdd: z.boolean().default(false),
  showWishlist: z.boolean().default(true),
  showRating: z.boolean().default(false),
  textAlign: z.enum(["left", "center"]).default("left"),
  /** Brand line above the product title (turn off for single-brand stores). */
  showBrand: z.boolean().default(true),
  /** Available sizes as small chips under the price. */
  showSizes: z.boolean().default(false),
  /** Store-wide offer label on every card, e.g. "Buy 2 Get 1". */
  offerBadge: plainText(24).default(""),
});
export type ProductCardSettings = z.infer<typeof productCardSchema>;
