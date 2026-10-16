/**
 * Layout variants: the different shapes a section (or the header/footer) can take. Each list's
 * FIRST value is the default and renders exactly as the section did before variants existed, so
 * theme documents saved earlier keep their look (the zod schemas default to it).
 *
 * Pure data, shared by the section schemas, the editor's variant picker, the per-category layout
 * personalities (../layouts) and the marketplace mockups.
 */

export type VariantOption<T extends string = string> = { value: T; label: string; hint: string };

const v = <T extends string>(value: T, label: string, hint: string): VariantOption<T> => ({ value, label, hint });

export const HERO_VARIANTS = [
  v("overlay", "Full-bleed image", "Text over a full-width photo"),
  v("split", "Split", "Photo on one side, text on a colour panel"),
  v("collage", "Editorial collage", "Big headline with three staggered photos"),
  v("minimal", "Centred minimal", "Large centred type, a wide photo below"),
  v("band", "Cinema band", "Short wide letterbox band, text underneath"),
  v("cards", "Card carousel", "Slides as rounded cards that peek in from the side"),
  v("framed", "Framed", "Inset rounded photo with a floating text card"),
] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number]["value"];

export const PRODUCT_GRID_VARIANTS = [
  v("grid", "Grid", "Even rows of product cards"),
  v("masonry", "Masonry", "Staggered columns with mixed heights"),
  v("lookbook", "Lookbook", "One hero product beside a block of four"),
  v("rail", "Horizontal rail", "A swipeable row (no JavaScript)"),
  v("bigtile", "Big tiles", "Two large tiles per row, name on the photo"),
  v("list", "List with details", "Rows: photo, name, price and a button"),
] as const;
export type ProductGridVariant = (typeof PRODUCT_GRID_VARIANTS)[number]["value"];

export const CATEGORY_VARIANTS = [
  v("grid", "Grid", "Even tiles (shape set below)"),
  v("mosaic", "Mosaic", "One large tile with smaller ones around it"),
  v("rail", "Horizontal rail", "A swipeable row of tiles"),
  v("index", "Editorial index", "Large type list with small photos"),
  v("pills", "Pills", "Compact chips with a round photo"),
] as const;
export type CategoryVariant = (typeof CATEGORY_VARIANTS)[number]["value"];

export const STORY_VARIANTS = [
  v("split", "Split", "Text beside a photo"),
  v("centered", "Centred statement", "Large centred text, numbers below"),
  v("overlay", "Over a photo", "Text card over a full-width photo"),
  v("band", "Numbers band", "Coloured band with big numbers"),
  v("collage", "Collage", "Two overlapping photos beside the text"),
] as const;
export type StoryVariant = (typeof STORY_VARIANTS)[number]["value"];

export const TESTIMONIAL_VARIANTS = [
  v("grid", "Grid", "Three quotes side by side"),
  v("spotlight", "Spotlight", "One large quote, the rest as names"),
  v("cards", "Cards", "Bordered cards with initials"),
  v("marquee", "Scrolling strip", "Quotes scroll slowly across"),
  v("wall", "Quote wall", "Staggered columns of quotes"),
] as const;
export type TestimonialVariant = (typeof TESTIMONIAL_VARIANTS)[number]["value"];

export const NEWSLETTER_VARIANTS = [
  v("centered", "Centred", "Heading and form, centred"),
  v("split", "Split", "Heading left, form right"),
  v("banner", "Photo banner", "Form over a full-width photo"),
  v("card", "Card on photo", "A floating card over a photo"),
  v("inline", "Slim bar", "One compact line"),
] as const;
export type NewsletterVariant = (typeof NEWSLETTER_VARIANTS)[number]["value"];

/** TrustBadges layouts (the "USP band"); grid/marquee/line predate variants. */
export const USP_VARIANTS = [
  v("grid", "Grid", "Icons in a row of columns"),
  v("marquee", "Scrolling strip", "Promises scroll across"),
  v("line", "One quiet line", "Small text on one line"),
  v("cards", "Cards", "Each promise in a bordered card"),
  v("badges", "Big badges", "Large round icons in the accent colour"),
] as const;
export type UspVariant = (typeof USP_VARIANTS)[number]["value"];

export const HEADER_STYLES = [
  v("classic", "Classic", "Surface colour with a hairline border"),
  v("bordered", "Double rule", "Taller, with a double line underneath"),
  v("inverted", "Inverted", "Primary colour bar with light text"),
  v("floating", "Floating", "A rounded bar floating over the page"),
  v("minimal", "Minimal", "No border, blends into the page"),
  v("editorial", "Editorial", "Tall, oversized logo, spaced menu"),
] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number]["value"];

export const FOOTER_LAYOUTS = [
  v("columns", "Columns", "Brand, menus and contact in columns"),
  v("centered", "Centred", "Everything centred and stacked"),
  v("minimal", "Minimal", "One compact row"),
  v("statement", "Statement", "Columns with a giant store name below"),
] as const;
export type FooterLayout = (typeof FOOTER_LAYOUTS)[number]["value"];

/** Vertical rhythm per section (wraps the section's own padding). */
export const SECTION_SPACINGS = [
  v("default", "Theme default", "Uses the theme spacing"),
  v("compact", "Compact", "Less space above and below"),
  v("airy", "Airy", "More space above and below"),
  v("flush", "Flush", "No space; butts against neighbours"),
] as const;
export type SectionSpacing = (typeof SECTION_SPACINGS)[number]["value"];

/** Per-section product image shape; "theme" uses the global product card setting. */
export const CARD_RATIOS = [
  v("theme", "Theme default", "Product card setting"),
  v("portrait", "Portrait 3:4", ""),
  v("tall", "Tall 2:3", ""),
  v("square", "Square", ""),
  v("landscape", "Landscape 4:3", ""),
] as const;
export type CardRatio = (typeof CARD_RATIOS)[number]["value"];

export const HERO_MEDIA_RATIOS = [
  v("auto", "Automatic", "Best shape for the layout"),
  v("portrait", "Portrait", ""),
  v("square", "Square", ""),
  v("landscape", "Landscape", ""),
] as const;
export type HeroMediaRatio = (typeof HERO_MEDIA_RATIOS)[number]["value"];

/** z.enum-ready tuple of a variant list's values. */
export function values<T extends string>(list: readonly VariantOption<T>[]): [T, ...T[]] {
  return list.map((o) => o.value) as [T, ...T[]];
}
