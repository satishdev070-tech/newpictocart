/**
 * Image standards (pure): for each place an image is used, the crop shape and the output size
 * the browser resizes to before uploading. The cropper presets its aspect from here and the theme
 * editor shows "Recommended 2400×1350, 16:9" under each image field.
 *
 * Theme fields are mapped by section type + field key (and the layout variant where it changes the
 * shape). Section definitions are not edited for this; unknown fields fall back to a guess from the
 * field key / label, then to the general standard.
 */

export type ImagePurpose =
  | "logo"
  | "favicon"
  | "heroDesktop"
  | "heroMobile"
  | "collageTile"
  | "banner"
  | "product"
  | "square"
  | "portrait"
  | "landscape"
  | "blogCover"
  | "videoCover"
  | "ogImage"
  | "icon"
  | "brandLogo"
  | "illustration"
  | "general";

/** Width / height, or null for a free crop. */
export type Aspect = { w: number; h: number } | null;

export type ImageStandard = {
  purpose: ImagePurpose;
  label: string;
  /** Preset crop shape (null = free). */
  aspect: Aspect;
  /** Output is scaled down (never up) to fit inside this box. */
  maxWidth: number;
  maxHeight: number;
  /** Keep transparency (PNG / WebP output) instead of flattening onto white. */
  transparent: boolean;
  /** Other shapes worth offering first for this purpose (besides Free / 1:1 / 4:5 / 16:9). */
  alternatives?: readonly { w: number; h: number }[];
};

const std = (purpose: ImagePurpose, label: string, aspect: Aspect, maxWidth: number, maxHeight: number, extra: Partial<ImageStandard> = {}): ImageStandard => ({ purpose, label, aspect, maxWidth, maxHeight, transparent: false, ...extra });

export const IMAGE_STANDARDS: Record<ImagePurpose, ImageStandard> = {
  logo: std("logo", "Logo", null, 960, 400, { transparent: true }),
  favicon: std("favicon", "Favicon", { w: 1, h: 1 }, 512, 512, { transparent: true }),
  heroDesktop: std("heroDesktop", "Hero (desktop)", { w: 16, h: 9 }, 2400, 1350),
  heroMobile: std("heroMobile", "Hero (mobile)", { w: 4, h: 5 }, 1080, 1350),
  collageTile: std("collageTile", "Collage tile", { w: 4, h: 5 }, 1600, 2000, { alternatives: [{ w: 1, h: 1 }] }),
  banner: std("banner", "Banner", { w: 3, h: 1 }, 2400, 800),
  product: std("product", "Product photo", { w: 1, h: 1 }, 2000, 2000, { alternatives: [{ w: 4, h: 5 }] }),
  square: std("square", "Square photo", { w: 1, h: 1 }, 1600, 1600),
  portrait: std("portrait", "Portrait photo", { w: 4, h: 5 }, 1600, 2000),
  landscape: std("landscape", "Landscape photo", { w: 3, h: 2 }, 2000, 1334),
  blogCover: std("blogCover", "Blog cover", { w: 16, h: 9 }, 1600, 900),
  videoCover: std("videoCover", "Video cover", { w: 16, h: 9 }, 1920, 1080),
  ogImage: std("ogImage", "Social share image", { w: 1.91, h: 1 }, 1200, 630),
  icon: std("icon", "Icon", { w: 1, h: 1 }, 256, 256, { transparent: true }),
  brandLogo: std("brandLogo", "Brand logo", null, 600, 300, { transparent: true }),
  illustration: std("illustration", "Illustration", null, 2400, 1200, { transparent: true }),
  general: std("general", "Image", null, 2400, 2400, { transparent: true }),
};

/** Aspects offered by the cropper besides the preset: Free, 1:1, 4:5, 16:9. */
export const COMMON_ASPECTS: readonly { label: string; aspect: Aspect }[] = [
  { label: "Free", aspect: null },
  { label: "1:1", aspect: { w: 1, h: 1 } },
  { label: "4:5", aspect: { w: 4, h: 5 } },
  { label: "16:9", aspect: { w: 16, h: 9 } },
];

export function aspectRatio(a: Aspect): number | null {
  return a ? a.w / a.h : null;
}

export function aspectLabel(a: Aspect): string {
  return a ? `${a.w}:${a.h}` : "Free";
}

export function sameAspect(a: Aspect, b: Aspect): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.w / a.h - b.w / b.h) < 0.005;
}

/** The cropper's aspect choices for a standard: preset first, then alternatives and the common ones (no duplicates). */
export function aspectChoices(s: ImageStandard): { label: string; aspect: Aspect }[] {
  const out: { label: string; aspect: Aspect }[] = [];
  const add = (label: string, aspect: Aspect) => {
    if (!out.some((o) => sameAspect(o.aspect, aspect))) out.push({ label, aspect });
  };
  if (s.aspect) add(`${aspectLabel(s.aspect)} (recommended)`, s.aspect);
  for (const a of s.alternatives ?? []) add(aspectLabel(a), a);
  for (const c of COMMON_ASPECTS) add(c.aspect === null && s.aspect === null ? "Free (recommended)" : c.label, c.aspect);
  return out;
}

/** "Recommended 2400×1350, 16:9" / "Recommended up to 960×400, any shape". */
export function recommendedText(s: ImageStandard): string {
  if (!s.aspect) return `Recommended up to ${s.maxWidth}×${s.maxHeight}, any shape${s.transparent && s.purpose !== "general" ? " (transparent PNG works)" : ""}`;
  return `Recommended ${s.maxWidth}×${s.maxHeight}, ${aspectLabel(s.aspect)}`;
}

// ------------------------------------------------------------------ theme field mapping

/** Where a theme image field lives. `variant` is the section's layout variant when known. */
export type ImageSlot = { sectionType?: string; fieldKey: string; label?: string; variant?: string };

type Rule = ImagePurpose | ((variant: string | undefined) => ImagePurpose);

/** Section type → field key → purpose. Field keys inside list items use the item field's key. */
const SECTION_FIELDS: Record<string, Record<string, Rule>> = {
  Hero: {
    imagePath: (v) => (v === "collage" ? "collageTile" : "heroDesktop"),
    mobileImagePath: "heroMobile",
    // Editorial collage photos 2 and 3 (section-level fields, collage only).
    image2Path: "collageTile",
    image3Path: "collageTile",
  },
  PromoBanner: { imagePath: "banner" },
  CategoryGrid: { imagePath: "portrait" },
  CollectionGrid: { imagePath: "portrait" },
  EditorialImageText: { imagePath: "portrait" },
  VideoBanner: { posterPath: "videoCover" },
  VideoShop: { posterPath: "portrait" },
  Lookbook: { imagePath: "portrait" },
  BrandStory: { imagePath: "portrait" },
  SocialProof: { imagePath: "portrait" },
  Newsletter: { imagePath: (v) => (v === "banner" ? "banner" : "portrait") },
  TrustBadges: { icon: "icon" },
  BrandStrip: { imagePath: "brandLogo" },
  FeatureBand: { imagePath: "landscape" },
  Footer: { imagePath: "illustration" },
  Gallery: { imagePath: "general" },
  Team: { imagePath: "square" },
  CallToAction: { imagePath: (v) => (v === "cta-image" ? "heroDesktop" : "portrait") },
  BlogPosts: { imagePath: "blogCover" },
  // Pseudo "sections" for settings outside the section list.
  header: { logoPath: "logo", faviconPath: "favicon" },
  seo: { socialImagePath: "ogImage", ogImagePath: "ogImage" },
  popup: { imagePath: "portrait" },
};

/** Guess from the key / label when the section is unknown (e.g. the classic editor, page settings). */
function guess(fieldKey: string, label = ""): ImagePurpose {
  const k = fieldKey.toLowerCase();
  const l = label.toLowerCase();
  if (k.includes("favicon") || l.includes("favicon")) return "favicon";
  if (k.includes("logo") || /\blogo\b/.test(l)) return "logo";
  if (k.includes("og") || k.includes("social") || l.includes("social share") || l.includes("share image")) return "ogImage";
  if (k === "icon" || /\bicon\b/.test(l)) return "icon";
  if (k.includes("mobile") || l.includes("mobile")) return "heroMobile";
  if (l.includes("desktop")) return "heroDesktop";
  if (k.includes("poster") || l.includes("cover")) return "videoCover";
  if (k.includes("banner") || l.includes("banner")) return "banner";
  if (l.includes("illustration")) return "illustration";
  return "general";
}

export function purposeForSlot(slot: ImageSlot): ImagePurpose {
  const rule = slot.sectionType ? SECTION_FIELDS[slot.sectionType]?.[slot.fieldKey] : undefined;
  if (rule) return typeof rule === "function" ? rule(slot.variant) : rule;
  return guess(slot.fieldKey, slot.label);
}

export function standardForSlot(slot: ImageSlot): ImageStandard {
  return IMAGE_STANDARDS[purposeForSlot(slot)];
}
