import type { z } from "zod";

/**
 * Section registry contracts. A definition is PURE data + a zod schema (usable from the
 * client editor and from tests); renderers live in a separate server-only map keyed by the
 * same type (./renderers.tsx) so the editor bundle never pulls in server code.
 */

export const SECTION_TYPES = [
  "AnnouncementBar",
  "Header",
  "MegaMenu",
  "Hero",
  "PromoBanner",
  "CategoryGrid",
  "CollectionGrid",
  "ProductCarousel",
  "ProductGrid",
  "Bestseller",
  "NewArrivals",
  "SaleBanner",
  "EditorialImageText",
  "VideoBanner",
  "Lookbook",
  "BrandStory",
  "Testimonials",
  "Reviews",
  "SocialProof",
  "Newsletter",
  "FAQ",
  "TrustBadges",
  "Marquee",
  "BrandStrip",
  "VideoShop",
  "ProductSpotlight",
  "CompactProducts",
  "FeatureBand",
  "DecorDivider",
  "PageContent",
  // Page sections (definitions-pages.ts / render/sections-pages.tsx)
  "ContactInfo", "RichText", "BlogPosts", "Gallery", "Team", "CallToAction",
  "Footer",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Where a section may be placed. The site-builder templates (collectionList … account) and custom
 * pages ("custom") accept every section allowed on the home page, plus the PageContent marker on
 * templates (see config.ts groupAllows), so definitions only list the original five groups.
 */
export const SECTION_GROUPS = ["header", "footer", "home", "collection", "product", "collectionList", "page", "blog", "search", "cart", "account", "custom"] as const;
export type SectionGroup = (typeof SECTION_GROUPS)[number];

/** Editor-side pickers are populated from the tenant's catalog/content. */
export type PickerKind = "collection" | "category" | "product" | "page" | "blogPost" | "menu";

type FieldBase = {
  key: string;
  label: string;
  help?: string;
  /** Only show this field when another field in the same object has one of these values. */
  showIf?: { key: string; equals: readonly (string | boolean)[] };
};

export type EditorField =
  | (FieldBase & { kind: "text"; maxLength: number; multiline?: boolean; placeholder?: string })
  | (FieldBase & { kind: "number"; min: number; max: number; step?: number })
  | (FieldBase & {
      kind: "select";
      options: readonly { value: string; label: string; hint?: string }[];
      /** "variants": shown as a grid of layout cards (with a small diagram) instead of a dropdown. */
      display?: "variants";
    })
  | (FieldBase & { kind: "toggle" })
  | (FieldBase & { kind: "color" })
  | (FieldBase & { kind: "image" })
  | (FieldBase & { kind: "link"; placeholder?: string })
  | (FieldBase & { kind: "video" })
  | (FieldBase & {
      /** Per-text look: font, weight, size, colour, align, bold/italic/underline, and text-box width. */
      kind: "textStyle";
      /** Which copy field this styles (heading / subheading / body / cta / eyebrow) — used by canvas chrome. */
      role: "heading" | "subheading" | "body" | "cta" | "eyebrow";
    })
  | (FieldBase & { kind: "picker"; picker: PickerKind })
  | (FieldBase & { kind: "multiPicker"; picker: "product" | "collection" | "category"; max: number })
  | (FieldBase & { kind: "tags"; max: number; placeholder?: string })
  | (FieldBase & { kind: "list"; itemLabel: string; min?: number; max: number; fields: EditorField[] });

export type SectionDefinition<S extends z.ZodType = z.ZodType> = {
  type: SectionType;
  label: string;
  description: string;
  /** Groups this section can be added to. */
  groups: readonly SectionGroup[];
  /** At most one instance per group (e.g. Header, Footer). */
  singleton?: boolean;
  schema: S;
  fields: EditorField[];
};

export type SectionVisibility = { desktop: boolean; mobile: boolean };

/** Per-section colour overrides from the builder's colour (droplet) panel; empty = theme colours. */
export type SectionStyle = { background: string; text: string; accent: string };

/** Section content widths; absent = the theme's container width. */
export const SECTION_BOX_WIDTHS = ["narrow", "wide", "full"] as const;
export type SectionBoxWidth = (typeof SECTION_BOX_WIDTHS)[number];
/** Vertical spacing sides (px). */
export const SECTION_BOX_SIDES = ["marginTop", "marginBottom", "paddingTop", "paddingBottom"] as const;
export type SectionBoxSide = (typeof SECTION_BOX_SIDES)[number];
/**
 * Limits shared by the schema, the renderer and the builder sliders.
 * `space` covers margins (negative allowed so sections can pull together); padding stays ≥ 0.
 */
export const SECTION_BOX_LIMITS = {
  scale: { min: 80, max: 130, step: 5 },
  space: { min: -80, max: 160 },
  padding: { min: 0, max: 160 },
  mobileFactor: 0.6,
} as const;

/**
 * Per-section size & spacing (every key optional = theme default). `scale` is a percentage
 * (80–130, steps of 5) of the section's type and item sizes; margins are px (−80–160), padding
 * 0–160. `mobile` holds explicit phone values; a missing phone value is 60% of the desktop one.
 */
export type SectionBox = {
  scale?: number;
  width?: SectionBoxWidth;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingBottom?: number;
  mobile?: Partial<Record<SectionBoxSide, number>>;
};

export type SectionInstance<T = Record<string, unknown>> = {
  id: string;
  type: SectionType;
  settings: T;
  visibility: SectionVisibility;
  /** Only present when at least one colour is set. */
  style?: SectionStyle;
  /** Size & spacing overrides (builder Settings tab); only present when at least one value is set. */
  box?: SectionBox;
};
