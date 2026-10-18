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
  // Section designs, group a: slideshows (each slide's text shows with its photo)
  v("hero-fade", "Fade slideshow", "Slides cross-fade, photo thumbnails below"),
  v("hero-slider", "Split slider", "Text panel beside the photo, numbered progress"),
  v("hero-kenburns", "Slow-zoom slideshow", "Full-width slides with a gentle zoom"),
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
  // Section designs, group a
  v("cat-circles", "Circle avatars", "Round photos with names, swipeable on phones"),
  v("cat-overlay", "Overlay cards", "Name centred over each photo"),
  v("cat-bento", "Bento", "Mixed-size tiles in a staggered grid"),
  v("cat-banners", "Banner rows", "Wide rows with number, name and description"),
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

// --- Section designs, group b (every list's first value = the section's look before designs existed) ---

export const ANNOUNCEMENT_VARIANTS = [
  v("announce-bar", "Classic bar", "Messages in a row, or one at a time"),
  v("announce-ticker", "Scrolling ticker", "Messages scroll slowly across"),
  v("announce-split", "Split", "Main message left, the rest on the right"),
] as const;
export type AnnouncementVariant = (typeof ANNOUNCEMENT_VARIANTS)[number]["value"];

export const MEGA_MENU_VARIANTS = [
  v("mega-dropdown", "Dropdown", "Centred menu with compact dropdowns"),
  v("mega-wide", "Full-width panels", "Wide dropdowns with columns and photos"),
  v("mega-inverted", "Colour bar", "Left-aligned menu on a primary colour bar"),
] as const;
export type MegaMenuVariant = (typeof MEGA_MENU_VARIANTS)[number]["value"];

export const PRODUCT_CAROUSEL_VARIANTS = [
  v("cards", "Product cards", "A row of product cards with arrows"),
  v("tilt", "Tilted photos", "Photos at playful angles, names on them"),
  v("rail", "Swipe row", "A swipeable row without arrows"),
  v("carousel-tiles", "Big photo slides", "Large photos with name and price on them"),
] as const;
export type ProductCarouselVariant = (typeof PRODUCT_CAROUSEL_VARIANTS)[number]["value"];

export const SALE_BANNER_VARIANTS = [
  v("sale-band", "Centred band", "Bold centred text on a colour band"),
  v("sale-split", "Split", "Headline left, code and button right"),
  v("sale-ticket", "Coupon ticket", "A dashed coupon card with a big code"),
] as const;
export type SaleBannerVariant = (typeof SALE_BANNER_VARIANTS)[number]["value"];

export const VIDEO_BANNER_VARIANTS = [
  v("video-boxed", "Boxed", "Heading above a rounded video"),
  v("video-fullbleed", "Full width", "Edge-to-edge video, text on it"),
  v("video-split", "Video beside text", "Video on one side, story on the other"),
] as const;
export type VideoBannerVariant = (typeof VIDEO_BANNER_VARIANTS)[number]["value"];

export const LOOKBOOK_VARIANTS = [
  v("masonry", "Masonry", "Staggered columns of photos"),
  v("row", "Even grid", "Photos in even rows"),
  v("arches", "Arches", "Arched photos beside the heading"),
  v("lookbook-rail", "Swipe row", "Tall photos in a swipeable row"),
] as const;
export type LookbookVariant = (typeof LOOKBOOK_VARIANTS)[number]["value"];

export const REVIEWS_VARIANTS = [
  v("reviews-carousel", "Carousel", "Rating summary above a row of reviews"),
  v("reviews-grid", "Grid", "Reviews in even rows"),
  v("reviews-split", "Summary beside reviews", "Big rating on the left, reviews right"),
] as const;
export type ReviewsVariant = (typeof REVIEWS_VARIANTS)[number]["value"];

export const MARQUEE_VARIANTS = [
  v("marquee-strip", "Single strip", "One line scrolling across"),
  v("marquee-double", "Two rows", "Two lines scrolling in opposite directions"),
  v("marquee-tilted", "Tilted band", "A slightly tilted scrolling ribbon"),
] as const;
export type MarqueeVariant = (typeof MARQUEE_VARIANTS)[number]["value"];

export const BRAND_STRIP_VARIANTS = [
  v("row", "Row", "Logos centred in a row"),
  v("marquee", "Scrolling strip", "Logos scroll across"),
  v("brands-grid", "Logo grid", "Each logo in a bordered cell"),
] as const;
export type BrandStripVariant = (typeof BRAND_STRIP_VARIANTS)[number]["value"];

export const VIDEO_SHOP_VARIANTS = [
  v("cards", "Vertical cards", "9:16 video cards in a row"),
  v("stories", "Round stories", "Small round story bubbles"),
  v("videos-grid", "Video grid", "All videos in even rows"),
] as const;
export type VideoShopVariant = (typeof VIDEO_SHOP_VARIANTS)[number]["value"];

export const SPOTLIGHT_VARIANTS = [
  v("spotlight-switcher", "Switcher", "Thumbnails, one big product at a time"),
  v("spotlight-reverse", "Mirrored", "Details on the left, photo on the right"),
  v("spotlight-rows", "All in rows", "Every product as its own row"),
] as const;
export type SpotlightVariant = (typeof SPOTLIGHT_VARIANTS)[number]["value"];

export const COMPACT_VARIANTS = [
  v("compact-grid", "Grid", "Small thumbnails, several per row"),
  v("compact-list", "List", "One product per line, button on the right"),
  v("compact-rail", "Swipe row", "Compact items in a swipeable row"),
] as const;
export type CompactVariant = (typeof COMPACT_VARIANTS)[number]["value"];

export const FEATURE_BAND_VARIANTS = [
  v("band-feature", "Photo beside products", "Feature photo left, product cards right"),
  v("band-reverse", "Products beside photo", "Product cards left, feature photo right"),
  v("band-stacked", "Photo above products", "A wide photo banner, products below"),
] as const;
export type FeatureBandVariant = (typeof FEATURE_BAND_VARIANTS)[number]["value"];

export const DECOR_VARIANTS = [
  v("divider", "Ornament", "A centred ornament between sections"),
  v("margins", "Page margins", "Faint feathers in the side margins"),
  v("decor-title", "Ornamented title", "A heading and text framed by the motif"),
] as const;
export type DecorVariant = (typeof DECOR_VARIANTS)[number]["value"];

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
  // Section designs, group a
  v("footer-mega", "Mega with newsletter", "Sign-up row, then wide link columns"),
  v("footer-brand", "Brand panel", "Colour panel with your name beside the menus"),
  v("footer-app", "Contact buttons", "Big tap-friendly contact buttons, compact menus"),
  v("footer-illustrated", "Illustrated", "Your illustration or artwork across the footer"),
  v("footer-tworow", "Two slim rows", "Name and menu on one line, details below"),
] as const;
export type FooterLayout = (typeof FOOTER_LAYOUTS)[number]["value"];

// --- Section designs, group a (every list's first value = the section's look before designs existed) ---

export const PROMO_VARIANTS = [
  v("tiles", "Image tiles", "One to three photo tiles side by side"),
  v("promo-fullwidth", "Full-width banner", "One edge-to-edge photo with the offer"),
  v("promo-split", "Split", "Photo beside a colour panel"),
  v("promo-mosaic", "Three-tile mosaic", "One large tile, two stacked beside it"),
  v("promo-overlap", "Overlapping card", "A text card overlapping the photo"),
  v("promo-strip", "Offer strip", "Slim colour strip with a badge and button"),
  v("promo-minimal", "Text only", "Large centred text and a button, no photo"),
] as const;
export type PromoVariant = (typeof PROMO_VARIANTS)[number]["value"];

export const FAQ_VARIANTS = [
  v("accordion", "Accordion", "Questions open one at a time"),
  v("faq-split", "Split", "Heading on the left, questions on the right"),
  v("faq-cards", "Cards", "Every answer visible in a grid of cards"),
  v("faq-numbered", "Numbered", "Centred numbered list with answers shown"),
  v("faq-chat", "Chat bubbles", "Questions and answers as a conversation"),
] as const;
export type FaqVariant = (typeof FAQ_VARIANTS)[number]["value"];

/** SocialProof (Instagram) layouts; grid / mosaic / strip predate designs. */
export const SOCIAL_VARIANTS = [
  v("grid", "Grid", "Even rows of square posts"),
  v("mosaic", "Mosaic", "First post large, the rest around it"),
  v("strip", "Reel strip", "One swipeable row of posts"),
  v("ig-profile", "Profile page", "Instagram-style header, bio and a tight grid"),
  v("ig-reels", "Reels carousel", "Tall 9:16 reels in a swipeable row"),
  v("ig-collage", "Collage with follow card", "Staggered posts around a Follow card"),
] as const;
export type SocialVariant = (typeof SOCIAL_VARIANTS)[number]["value"];

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
