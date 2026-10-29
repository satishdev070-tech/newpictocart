import { z } from "zod";
import { imagePath, plainText, safeHref, SECTION_ID_RE } from "./primitives";
import { PAGE_HANDLE_RE } from "./links";

/**
 * Site builder parts of the theme document (pure): custom pages, popups, embedded apps and the
 * per-level type scale. Every field is defaulted, so themes saved before the site builder parse to
 * "nothing extra" and render exactly as before.
 */

// -----------------------------------------------------------------------------
// Typography: H1–H6 and paragraph sizes. size 0 = the theme's own size (no CSS emitted).
// -----------------------------------------------------------------------------
export const TYPE_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "small"] as const;
export type TypeLevel = (typeof TYPE_LEVELS)[number];
export const TYPE_LEVEL_LABELS: Record<TypeLevel, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  p: "Paragraph",
  small: "Small text",
};
export const TYPE_WEIGHTS = ["default", "300", "400", "500", "600", "700", "800"] as const;
export const TYPE_FONTS = ["default", "heading", "body"] as const;

const typeStyle = z.object({
  /** Desktop size in px; phones get 80% of it (never below 12px). 0 = theme default. */
  size: z.coerce.number().int().min(0).max(120).default(0),
  weight: z.enum(TYPE_WEIGHTS).default("default"),
  font: z.enum(TYPE_FONTS).default("default"),
  /** Line height ×100 (e.g. 120 = 1.2). 0 = theme default. */
  lineHeight: z.coerce.number().int().min(0).max(250).default(0),
});
export type TypeStyle = z.infer<typeof typeStyle>;

const lvl = () => typeStyle.prefault({});
export const typographySchema = z
  .object({ h1: lvl(), h2: lvl(), h3: lvl(), h4: lvl(), h5: lvl(), h6: lvl(), p: lvl(), small: lvl() })
  .prefault({});
export type Typography = Record<TypeLevel, TypeStyle>;

/** Sizes the editor shows for "theme default" (approximate, for the preview list only). */
export const DEFAULT_TYPE_SIZES: Record<TypeLevel, number> = { h1: 48, h2: 36, h3: 28, h4: 22, h5: 18, h6: 16, p: 16, small: 13 };

// -----------------------------------------------------------------------------
// Custom pages built in the site builder (rendered at /pages/<handle>).
// -----------------------------------------------------------------------------
export const MAX_THEME_PAGES = 30;
export const pageMetaSchema = z.object({
  id: z.string().regex(SECTION_ID_RE, "Invalid page id"),
  handle: z.string().trim().regex(PAGE_HANDLE_RE, "Use lowercase letters, numbers and dashes"),
  title: plainText(80).pipe(z.string().min(1, "Give the page a title")),
  seoTitle: plainText(70).default(""),
  seoDescription: plainText(160).default(""),
  /** Image shown when the page is shared (Open Graph); empty = the store's default. */
  socialImagePath: imagePath.default(""),
  /** Hide from search engines (robots noindex). */
  noindex: z.boolean().default(false),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** Seller-chosen titles for built-in pages (Pages panel → Rename); empty = the default title. */
export const BUILTIN_TITLE_KEYS = ["blog", "contact", "faq"] as const;
export type BuiltinTitleKey = (typeof BUILTIN_TITLE_KEYS)[number];
export const BUILTIN_TITLE_DEFAULTS: Record<BuiltinTitleKey, string> = { blog: "Journal", contact: "Contact us", faq: "Frequently asked questions" };
export const builtinTitlesSchema = z
  .object({ blog: plainText(60).default(""), contact: plainText(60).default(""), faq: plainText(60).default("") })
  .prefault({});
export type BuiltinTitles = z.infer<typeof builtinTitlesSchema>;

/** Page handles the storefront already uses for its own routes (a theme page can't take them). */
export const RESERVED_PAGE_HANDLES = new Set(["home", "index", "new", "edit", "preview"]);

// -----------------------------------------------------------------------------
// Popups
// -----------------------------------------------------------------------------
export const POPUP_TRIGGERS = ["delay", "exit", "link"] as const;
export const POPUP_LAYOUTS = ["center", "image-left", "bottom-bar"] as const;
export const POPUP_CONTENT_TYPES = ["newsletter", "form"] as const;
export const POPUP_FIELD_TYPES = ["text", "email", "phone", "textarea", "select", "radio", "checkbox"] as const;
export const MAX_POPUPS = 10;
export const MAX_POPUP_FIELDS = 8;

export type PopupContentType = (typeof POPUP_CONTENT_TYPES)[number];
export type PopupFieldType = (typeof POPUP_FIELD_TYPES)[number];

export const popupFormFieldSchema = z.object({
  id: z.string().regex(SECTION_ID_RE, "Invalid field id"),
  type: z.enum(POPUP_FIELD_TYPES).default("text"),
  label: plainText(80).pipe(z.string().min(1, "Label the field")),
  required: z.boolean().default(false),
  /** Choices for select / radio / checkbox groups. */
  options: z.array(plainText(80)).max(20).default([]),
});
export type PopupFormField = z.infer<typeof popupFormFieldSchema>;

export const popupFormSchema = z
  .object({
    fields: z.array(popupFormFieldSchema).max(MAX_POPUP_FIELDS).default([]),
    submitLabel: plainText(40).default("Send"),
    successMessage: plainText(200).default("Thanks — we got your message."),
  })
  .prefault({});
export type PopupForm = z.infer<typeof popupFormSchema>;

/** Default custom-form fields when a seller switches a popup to “Custom form”. */
export function defaultPopupFormFields(): PopupFormField[] {
  return [
    { id: "fname00001", type: "text", label: "Name", required: true, options: [] },
    { id: "femail0001", type: "email", label: "Email", required: true, options: [] },
    { id: "fmsg000001", type: "textarea", label: "Message", required: true, options: [] },
  ];
}

export const popupSchema = z.object({
  id: z.string().regex(SECTION_ID_RE, "Invalid popup id"),
  name: plainText(60).pipe(z.string().min(1, "Name the popup")),
  enabled: z.boolean().default(true),
  /** delay: after N seconds · exit: when the pointer leaves the page (desktop) · link: only from a #popup link. */
  trigger: z.enum(POPUP_TRIGGERS).default("delay"),
  delaySeconds: z.coerce.number().int().min(0).max(120).default(5),
  /** Shown at most once per browser session unless "always". */
  frequency: z.enum(["session", "always"]).default("session"),
  /** Where automatic triggers fire. */
  where: z.enum(["all", "home"]).default("all"),
  layout: z.enum(POPUP_LAYOUTS).default("center"),
  eyebrow: plainText(60).default(""),
  heading: plainText(120).default(""),
  text: plainText(400).default(""),
  imagePath: imagePath.default(""),
  imageAlt: plainText(200).default(""),
  ctaLabel: plainText(40).default(""),
  ctaHref: safeHref.default(""),
  /**
   * Legacy email sign-up flag. Kept so themes saved before contentType still parse.
   * When contentType is "newsletter", true shows the newsletter form; false keeps a plain CTA.
   */
  newsletter: z.boolean().default(false),
  /** Newsletter signup or a custom field form (Phase E). Default newsletter for back-compat. */
  contentType: z.enum(POPUP_CONTENT_TYPES).default("newsletter"),
  form: popupFormSchema,
});
export type Popup = z.infer<typeof popupSchema>;

// -----------------------------------------------------------------------------
// Embedded apps (built-in widgets; no third-party script injection).
// -----------------------------------------------------------------------------
export const embedsSchema = z
  .object({
    whatsapp: z
      .object({
        enabled: z.boolean().default(false),
        position: z.enum(["right", "left"]).default("right"),
        /** Pre-filled message (the number comes from Settings → Store details). */
        message: plainText(200).default("Hi! I have a question about your store."),
      })
      .prefault({}),
    backToTop: z.object({ enabled: z.boolean().default(false) }).prefault({}),
  })
  .prefault({});
export type Embeds = z.infer<typeof embedsSchema>;
