import { z } from "zod";
import { imagePath, plainText, safeHref } from "../schema/primitives";
import { textLookField } from "../schema/text-style";
import type { EditorField, SectionDefinition } from "./types";
import { SECTION_SPACINGS, values, type VariantOption } from "./variants";

/**
 * Page sections (definitions half): sections built for the site builder's custom pages (About,
 * Contact, Blog, Gallery, Team, policies) and allowed on the home page too. Pure data + zod, like
 * ./definitions.ts; renderers live in ../render/sections-pages.tsx. Every field is defaulted and
 * every value that reaches HTML goes through a primitive (plainText, safeHref, imagePath, or the
 * Google Maps embed allowlist below). Variant values are prefixed per section so the editor's
 * layout diagrams (site-builder/variant-diagrams-pages.ts) never collide with other sections.
 */

const txt = (max: number, def = "") => plainText(max).default(def);
const v = <T extends string>(value: T, label: string, hint: string): VariantOption<T> => ({ value, label, hint });
const variantSchema = <T extends string>(list: readonly VariantOption<T>[]) => z.enum(values(list)).default(list[0]!.value as never);
const variantEditor = (label: string, list: readonly VariantOption[]): EditorField => ({
  kind: "select",
  key: "variant",
  label,
  display: "variants",
  options: list.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
});

/** Widens field literals to EditorField (keeps SECTION_DEFINITIONS' field union uniform). */
const editorFields = (f: EditorField[]): EditorField[] => f;

const TONES = ["light", "dark", "accent", "muted"] as const;
const toneEditor: EditorField = { kind: "select", key: "tone", label: "Background", options: TONES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })) };
const spacingEditor: EditorField = { kind: "select", key: "spacing", label: "Space above and below", options: SECTION_SPACINGS.map((o) => ({ value: o.value, label: o.label })) };

const headingFields = { eyebrow: txt(60), heading: txt(120), subheading: txt(300) };
const headingEditor: EditorField[] = [
  { kind: "text", key: "eyebrow", label: "Eyebrow", maxLength: 60, placeholder: "Small text above the heading" },
  { kind: "text", key: "heading", label: "Heading", maxLength: 120 },
  { kind: "text", key: "subheading", label: "Subheading", maxLength: 300, multiline: true },
];
const commonFields = { tone: z.enum(TONES).default("light"), spacing: variantSchema(SECTION_SPACINGS) };

// -----------------------------------------------------------------------------
// Google Maps embed: only https://www.google.com/maps/embed?... The renderer rebuilds the URL
// from the parsed query string and shows it in a sandboxed iframe.
// -----------------------------------------------------------------------------

/** Pulls `src="…"` out of a pasted <iframe> snippet (Google's "Embed a map" copies HTML). */
function extractIframeSrc(input: string): string {
  const m = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(input);
  return (m ? m[1]! : input).replace(/&amp;/g, "&").trim();
}

/** Canonical embed URL for an allowed Google Maps embed link, or null. */
export function parseMapsEmbedUrl(input: string): string | null {
  const value = extractIframeSrc(input);
  if (!value || value.length > 2000 || /[\s\\<>"'`]/.test(value)) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "www.google.com" || u.port || u.username || u.password) return null;
  if (u.pathname !== "/maps/embed" || u.search.length < 2) return null;
  // u.search is the parser's own serialisation (percent-encoded, no quotes or spaces).
  return `https://www.google.com/maps/embed${u.search}`;
}

export const mapsEmbedUrl = z
  .string()
  .max(4000)
  .transform((v) => (v.trim() ? (parseMapsEmbedUrl(v) ?? `invalid:${v.trim().slice(0, 100)}`) : ""))
  .refine((v) => !v.startsWith("invalid:"), "Paste the link from Google Maps → Share → Embed a map (https://www.google.com/maps/embed?…)");

/** Optional email shown on the page (plain text; becomes a mailto: link). */
export const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const emailOrEmpty = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || EMAIL_RE.test(v), "Use an email like hello@yourstore.in");
/** Optional phone: digits, spaces, + - ( ). */
const phoneOrEmpty = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^\+?[\d\s()-]{8,24}$/.test(v), "Use a phone number like +91 98765 43210");

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

export const CONTACT_VARIANTS = [
  v("contact-cards", "Icon cards", "Phone, email and address in cards"),
  v("contact-split", "Details and map", "Details on one side, the map on the other"),
  v("contact-minimal", "Centred list", "A quiet centred list with buttons"),
] as const;

export const RICH_TEXT_VARIANTS = [
  v("richtext-narrow", "Article", "A readable single column"),
  v("richtext-centered", "Centred", "Centred heading and text"),
  v("richtext-columns", "Two columns", "Heading on the left, text on the right"),
  v("richtext-boxed", "Boxed", "Text in a bordered card"),
] as const;

export const BLOG_POSTS_VARIANTS = [
  v("blog-grid", "Grid", "Cards with cover photos"),
  v("blog-featured", "Featured", "One large story beside the rest"),
  v("blog-list", "List", "Rows with a small photo"),
] as const;

export const GALLERY_VARIANTS = [
  v("gallery-grid", "Grid", "Even rows of photos"),
  v("gallery-masonry", "Masonry", "Staggered columns, natural shapes"),
  v("gallery-carousel", "Carousel", "A swipeable row of photos"),
] as const;

export const TEAM_VARIANTS = [
  v("team-cards", "Cards", "Photo cards with name and role"),
  v("team-circles", "Round photos", "Centred round portraits"),
  v("team-list", "List", "Photo beside name, role and bio"),
] as const;

export const CTA_VARIANTS = [
  v("cta-band", "Colour band", "Centred text and buttons on a band"),
  v("cta-split", "Split", "Text and buttons beside a photo"),
  v("cta-card", "Card", "A rounded card inside the page"),
  v("cta-image", "Over a photo", "Text over a full-width photo"),
] as const;

// -----------------------------------------------------------------------------
// Definitions
// -----------------------------------------------------------------------------

const contactInfo = {
  type: "ContactInfo",
  label: "Contact details",
  description: "Phone, email, address and hours with icons, buttons to write or WhatsApp you, and an optional Google map.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(CONTACT_VARIANTS),
    ...headingFields,
    heading: txt(120, "Get in touch"),
    subheading: txt(300, "We usually reply within one working day."),
    showPhone: z.boolean().default(true),
    showEmail: z.boolean().default(true),
    showWhatsapp: z.boolean().default(true),
    showAddress: z.boolean().default(true),
    phone: phoneOrEmpty.default(""),
    email: emailOrEmpty.default(""),
    address: txt(300),
    hours: txt(160),
    /** Buttons under the details: mailto and/or WhatsApp (no form data is stored). */
    buttons: z.enum(["both", "email", "whatsapp", "none"]).default("both"),
    whatsappMessage: txt(200, "Hi! I have a question."),
    mapUrl: mapsEmbedUrl.default(""),
    mapHeight: z.enum(["small", "medium", "large"]).default("medium"),
    ...commonFields,
  }),
  fields: editorFields([
    variantEditor("Layout", CONTACT_VARIANTS),
    ...headingEditor,
    { kind: "toggle", key: "showPhone", label: "Show phone" },
    { kind: "text", key: "phone", label: "Phone (empty = store phone)", maxLength: 30, showIf: { key: "showPhone", equals: [true] } },
    { kind: "toggle", key: "showEmail", label: "Show email" },
    { kind: "text", key: "email", label: "Email (empty = store email)", maxLength: 254, showIf: { key: "showEmail", equals: [true] } },
    { kind: "toggle", key: "showWhatsapp", label: "Show WhatsApp" },
    { kind: "toggle", key: "showAddress", label: "Show address" },
    { kind: "text", key: "address", label: "Address (empty = store address)", maxLength: 300, multiline: true, showIf: { key: "showAddress", equals: [true] } },
    { kind: "text", key: "hours", label: "Opening hours (optional)", maxLength: 160, placeholder: "Mon–Sat, 10am–7pm" },
    {
      kind: "select",
      key: "buttons",
      label: "Contact buttons",
      options: [
        { value: "both", label: "Email and WhatsApp" },
        { value: "email", label: "Email only" },
        { value: "whatsapp", label: "WhatsApp only" },
        { value: "none", label: "No buttons" },
      ],
    },
    { kind: "text", key: "whatsappMessage", label: "WhatsApp message", maxLength: 200, showIf: { key: "buttons", equals: ["both", "whatsapp"] } },
    {
      kind: "text",
      key: "mapUrl",
      label: "Google map (optional)",
      maxLength: 2000,
      multiline: true,
      placeholder: "https://www.google.com/maps/embed?pb=…",
      help: "In Google Maps: Share → Embed a map → Copy HTML, then paste it here.",
    },
    { kind: "select", key: "mapHeight", label: "Map height", options: [{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }] },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

const richText = {
  type: "RichText",
  label: "Text",
  description: "A heading and paragraphs of text: policies, your story, size guides.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(RICH_TEXT_VARIANTS),
    ...headingFields,
    heading: txt(120, "About this page"),
    /** Plain text; blank lines start a new paragraph, single line breaks are kept. */
    body: txt(6000, "Write a few paragraphs here.\n\nLeave an empty line to start a new paragraph."),
    ctaLabel: txt(40),
    ctaHref: safeHref.default(""),
    headingLook: textLookField,
    subheadingLook: textLookField,
    bodyLook: textLookField,
    ctaLook: textLookField,
    ...commonFields,
  }),
  fields: editorFields([
    variantEditor("Layout", RICH_TEXT_VARIANTS),
    ...headingEditor,
    { kind: "textStyle", key: "headingLook", label: "Heading style", role: "heading" },
    { kind: "textStyle", key: "subheadingLook", label: "Subheading style", role: "subheading" },
    { kind: "text", key: "body", label: "Text", maxLength: 6000, multiline: true, help: "Leave an empty line between paragraphs." },
    { kind: "textStyle", key: "bodyLook", label: "Body style", role: "body" },
    { kind: "text", key: "ctaLabel", label: "Button text (optional)", maxLength: 40 },
    { kind: "link", key: "ctaHref", label: "Button link" },
    { kind: "textStyle", key: "ctaLook", label: "Button style", role: "cta" },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

const blogPosts = {
  type: "BlogPosts",
  label: "Blog posts",
  description: "Your latest blog stories with cover photos.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(BLOG_POSTS_VARIANTS),
    ...headingFields,
    heading: txt(120, "From the journal"),
    limit: z.coerce.number().int().min(1).max(12).default(3),
    showExcerpt: z.boolean().default(true),
    showDate: z.boolean().default(true),
    viewAllLabel: txt(40, "All stories"),
    ...commonFields,
  }),
  fields: editorFields([
    variantEditor("Layout", BLOG_POSTS_VARIANTS),
    ...headingEditor,
    { kind: "text", key: "viewAllLabel", label: "“View all” link text (empty = hide)", maxLength: 40 },
    { kind: "number", key: "limit", label: "Number of posts", min: 1, max: 12 },
    { kind: "toggle", key: "showExcerpt", label: "Show the summary" },
    { kind: "toggle", key: "showDate", label: "Show the date" },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

const galleryItem = z.object({ imagePath: imagePath.default(""), alt: txt(200), caption: txt(120), href: safeHref.default("") });
const gallery = {
  type: "Gallery",
  label: "Gallery",
  description: "A grid, masonry or swipeable row of photos with captions.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(GALLERY_VARIANTS),
    ...headingFields,
    heading: txt(120, "Gallery"),
    items: z
      .array(galleryItem)
      .max(24)
      .default([
        { imagePath: "", alt: "", caption: "", href: "" },
        { imagePath: "", alt: "", caption: "", href: "" },
        { imagePath: "", alt: "", caption: "", href: "" },
        { imagePath: "", alt: "", caption: "", href: "" },
        { imagePath: "", alt: "", caption: "", href: "" },
        { imagePath: "", alt: "", caption: "", href: "" },
      ]),
    columns: z.coerce.number().int().min(2).max(5).default(3),
    ratio: z.enum(["square", "portrait", "landscape"]).default("square"),
    captions: z.enum(["below", "overlay", "hidden"]).default("below"),
    ...commonFields,
  }),
  fields: editorFields([
    variantEditor("Layout", GALLERY_VARIANTS),
    ...headingEditor,
    {
      kind: "list",
      key: "items",
      label: "Photos",
      itemLabel: "Photo",
      max: 24,
      fields: [
        { kind: "image", key: "imagePath", label: "Photo" },
        { kind: "text", key: "alt", label: "Image description", maxLength: 200 },
        { kind: "text", key: "caption", label: "Caption (optional)", maxLength: 120 },
        { kind: "link", key: "href", label: "Link (optional)" },
      ],
    },
    { kind: "number", key: "columns", label: "Photos per row (desktop)", min: 2, max: 5 },
    { kind: "select", key: "ratio", label: "Photo shape", options: [{ value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }], showIf: { key: "variant", equals: ["gallery-grid", "gallery-carousel"] } },
    { kind: "select", key: "captions", label: "Captions", options: [{ value: "below", label: "Below the photo" }, { value: "overlay", label: "On the photo" }, { value: "hidden", label: "Hidden" }] },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

const member = z.object({ name: plainText(80).pipe(z.string().min(1, "Add a name")), role: txt(80), bio: txt(400), imagePath: imagePath.default(""), href: safeHref.default("") });
const team = {
  type: "Team",
  label: "Team",
  description: "The people behind the brand: photos, names, roles and a short bio.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(TEAM_VARIANTS),
    ...headingFields,
    heading: txt(120, "Meet the team"),
    members: z
      .array(member)
      .max(24)
      .default([
        { name: "Asha", role: "Founder", bio: "", imagePath: "", href: "" },
        { name: "Vikram", role: "Head of design", bio: "", imagePath: "", href: "" },
        { name: "Neha", role: "Customer care", bio: "", imagePath: "", href: "" },
      ]),
    columns: z.coerce.number().int().min(2).max(5).default(3),
    ...commonFields,
  }),
  fields: editorFields([
    variantEditor("Layout", TEAM_VARIANTS),
    ...headingEditor,
    {
      kind: "list",
      key: "members",
      label: "People",
      itemLabel: "Person",
      max: 24,
      fields: [
        { kind: "text", key: "name", label: "Name", maxLength: 80 },
        { kind: "text", key: "role", label: "Role", maxLength: 80 },
        { kind: "text", key: "bio", label: "Short bio (optional)", maxLength: 400, multiline: true },
        { kind: "image", key: "imagePath", label: "Photo" },
        { kind: "link", key: "href", label: "Profile link (optional)", placeholder: "https://www.linkedin.com/in/…" },
      ],
    },
    { kind: "number", key: "columns", label: "People per row (desktop)", min: 2, max: 5, showIf: { key: "variant", equals: ["team-cards", "team-circles"] } },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

const callToAction = {
  type: "CallToAction",
  label: "Call to action",
  description: "A short message with one or two buttons: shop now, contact us, join the list.",
  groups: ["home"],
  schema: z.object({
    variant: variantSchema(CTA_VARIANTS),
    eyebrow: txt(60),
    heading: txt(120, "Ready to find your favourite?"),
    text: txt(400, "Browse the full collection or write to us for help choosing."),
    ctaLabel: txt(40, "Shop now"),
    ctaHref: safeHref.default("/collections"),
    secondaryLabel: txt(40),
    secondaryHref: safeHref.default(""),
    imagePath: imagePath.default(""),
    alt: txt(200),
    tone: z.enum(TONES).default("accent"),
    spacing: variantSchema(SECTION_SPACINGS),
  }),
  fields: editorFields([
    variantEditor("Layout", CTA_VARIANTS),
    { kind: "text", key: "eyebrow", label: "Eyebrow", maxLength: 60 },
    { kind: "text", key: "heading", label: "Heading", maxLength: 120 },
    { kind: "text", key: "text", label: "Text", maxLength: 400, multiline: true },
    { kind: "text", key: "ctaLabel", label: "Button text", maxLength: 40 },
    { kind: "link", key: "ctaHref", label: "Button link" },
    { kind: "text", key: "secondaryLabel", label: "Second button text (optional)", maxLength: 40 },
    { kind: "link", key: "secondaryHref", label: "Second button link" },
    { kind: "image", key: "imagePath", label: "Photo", showIf: { key: "variant", equals: ["cta-split", "cta-image"] } },
    { kind: "text", key: "alt", label: "Image description", maxLength: 200, showIf: { key: "variant", equals: ["cta-split", "cta-image"] } },
    toneEditor,
    spacingEditor,
  ]),
} satisfies SectionDefinition;

/** Registered in ./definitions.ts SECTION_DEFINITIONS (spread). */
export const PAGE_SECTION_DEFINITIONS = {
  ContactInfo: contactInfo,
  RichText: richText,
  BlogPosts: blogPosts,
  Gallery: gallery,
  Team: team,
  CallToAction: callToAction,
} as const;
