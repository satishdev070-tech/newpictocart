import type { IndustrySlug } from "@/features/stores/industries";
import type { FooterLayout, HeaderStyle } from "../sections/variants";

/** Visual direction of a theme (marketplace "Style" filter). */
export const THEME_STYLES = ["minimal", "modern", "luxury", "editorial", "bold", "marketplace", "premium", "heritage", "conversion"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];
/**
 * A marketplace preset can be an online-shop design or a service / brochure website.
 * The field is optional so previously published custom themes and every legacy preset remain
 * eCommerce themes without a data migration.
 */
export const THEME_SITE_TYPES = ["ecommerce", "informative"] as const;
export type ThemeSiteType = (typeof THEME_SITE_TYPES)[number];
export const themeSiteType = (theme: Pick<MarketplaceTheme, "siteType">): ThemeSiteType => theme.siteType ?? "ecommerce";
export const THEME_STYLE_LABELS: Record<ThemeStyle, string> = {
  minimal: "Minimal",
  modern: "Modern",
  luxury: "Luxury",
  editorial: "Editorial",
  bold: "Bold",
  marketplace: "Marketplace",
  premium: "Premium",
  heritage: "Heritage",
  conversion: "Conversion focused",
};

/**
 * One home-page item: [section type, style settings, optional content slot]. A slot names a
 * section in the store's content pool (section id `slot-<name>`), so themes of one industry can
 * merchandise different parts of the same catalogue (deals, brands, a department...). Without a
 * matching slot, content is taken from the store's first unused section of the same type.
 */
export type HomeItem = [string, Record<string, unknown>] | [string, Record<string, unknown>, string];

export type ThemePreset = {
  tokens: Record<string, unknown> & { colors: Record<string, string>; headingFont: string; bodyFont: string };
  header: Record<string, unknown>;
  headerLayout: "logo-left" | "logo-center";
  productCard: Record<string, unknown>;
  footerTone: "dark" | "light" | "muted";
  announcementTone: string;
  inlineMenu: boolean;
  hero: { align: string; textTone: string };
  home: HomeItem[];
  menuStyle?: "bar" | "drawer";
  announcementMode?: "static" | "rotate";
  footerDecor?: "none" | "ethnic";
  collection?: HomeItem[];
  product?: HomeItem[];
  /** Header bar look (../sections/variants HEADER_STYLES). Unset: from the industry's layout personality. */
  headerStyle?: HeaderStyle;
  /** Footer arrangement (FOOTER_LAYOUTS). Unset: from the industry's layout personality. */
  footerLayout?: FooterLayout;
  /** Layout family / stock-photo category, stamped by withLayout from the theme's industry. */
  family?: string;
  /**
   * First-use copy for a brochure theme. It is applied only when the current site is still the
   * untouched commerce starter, so changing a theme never overwrites a seller's own copy.
   */
  informativeSeed?: {
    /** Guards seeds when a consumer derives a different composition from this preset. */
    homeTypes: string;
    announcement?: Record<string, unknown>;
    home?: Record<number, { type: string; settings: Record<string, unknown> }>;
    footer?: Record<string, unknown>;
  };
};

export type MarketplaceTheme = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  industry: IndustrySlug;
  style: ThemeStyle;
  /** Defaults to eCommerce for legacy and custom marketplace themes. */
  siteType?: ThemeSiteType;
  bestFor: string[];
  features: string[];
  /** Showcase store used for Live Preview ({slug}.{platform root}); null when none yet. */
  demo: string | null;
  version: string;
  /** ISO date the theme was added (marketplace "Newest" sort). */
  added: string;
  preset: ThemePreset;
};
