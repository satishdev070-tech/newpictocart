import { z } from "zod";
import { email, indianMobile, uuid } from "@/lib/validation/common";
import { bool, intWithDefault, optionalHttpsUrl, optionalInt, optionalRupees, optionalText } from "@/features/settings/fields";
import { INFO_CATEGORY_IDS } from "./categories";
import { PRICE_TYPES, priceTypeNeedsAmount } from "./pricing";
import { INFO_SLUG_RE, RESERVED_PAGE_SLUGS } from "./slug";
import { sectionsSchema } from "./sections";

/**
 * Input validators for the Informative Website (pure; shared by server actions and client forms).
 * Inputs arrive from formToObject(): strings, or undefined when blank. Money is integer paise.
 * The tenant is NEVER part of an input: services take it from the member's context.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalSlug = z.preprocess(
  blankToUndefined,
  z.string().trim().toLowerCase().max(120).regex(INFO_SLUG_RE, "Use lowercase letters, numbers and single hyphens").optional(),
);
const storagePath = z.preprocess(blankToUndefined, z.string().trim().max(500).regex(/^tenant\/[0-9a-f-]{36}\/[^\s]+$/, "Invalid image").optional());
const hexColor = z.preprocess(blankToUndefined, z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1FA2A6").optional());
const optionalPhone = z.preprocess(blankToUndefined, indianMobile.optional());
const optionalEmail = z.preprocess(blankToUndefined, email.optional());

// ---- Site ------------------------------------------------------------------------------------

export const businessInfoSchema = z.object({
  businessName: z.string().trim().min(2, "At least 2 characters").max(80),
  tagline: optionalText(120),
  category: z.enum(INFO_CATEGORY_IDS),
  about: optionalText(5000),
  phone: indianMobile,
  whatsappSameAsPhone: bool.default(false),
  whatsapp: optionalPhone,
  email: email,
  city: z.string().trim().min(2, "Enter your city").max(80),
  address: optionalText(300),
  mapUrl: optionalHttpsUrl,
});
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
/** day: 0 = Sunday … 6 = Saturday. */
export const hoursSchema = z
  .array(z.object({ day: z.number().int().min(0).max(6), open: time, close: time, closed: z.boolean().default(false) }))
  .max(7)
  .refine((list) => new Set(list.map((h) => h.day)).size === list.length, "One row per day")
  .refine((list) => list.every((h) => h.closed || h.open < h.close), "Closing time must be after opening time");
export type OpeningHours = z.infer<typeof hoursSchema>;

export const SOCIAL_NETWORKS = ["instagram", "facebook", "youtube", "linkedin", "x", "website"] as const;
export const socialLinksSchema = z.object(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, optionalHttpsUrl])) as Record<(typeof SOCIAL_NETWORKS)[number], typeof optionalHttpsUrl>);

export const appearanceSchema = z.object({
  themeId: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  fontPair: z.preprocess(blankToUndefined, z.string().regex(/^[a-z0-9-]{2,40}$/).optional()),
  logoPath: storagePath,
  faviconPath: storagePath,
  heroImagePath: storagePath,
});
export type AppearanceInput = z.infer<typeof appearanceSchema>;

export const seoSchema = z.object({
  title: optionalText(70),
  description: optionalText(160),
  ogImagePath: storagePath,
});
export type SeoInput = z.infer<typeof seoSchema>;

export const siteOptionsSchema = z.object({
  enquirySuccessMessage: optionalText(300),
  showPreferredDateTime: bool.optional(),
  privacyText: optionalText(5000),
});

export const notificationSettingsSchema = z.object({
  notifyEmail: optionalEmail,
  notifyEmailEnabled: bool.default(true),
  notifyWhatsappEnabled: bool.default(false),
});

// ---- Content ---------------------------------------------------------------------------------

export const serviceSchema = z
  .object({
    name: z.string().trim().min(1, "Add a name").max(120),
    slug: optionalSlug,
    shortDescription: optionalText(300),
    description: optionalText(10000),
    imagePath: storagePath,
    priceType: z.enum(PRICE_TYPES).default("ON_REQUEST"),
    pricePaise: optionalRupees,
    durationMinutes: optionalInt(1, 1440),
    category: optionalText(60),
    isFeatured: bool.default(false),
    isActive: bool.default(true),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
  })
  .superRefine((v, ctx) => {
    if (priceTypeNeedsAmount(v.priceType) && v.pricePaise == null) ctx.addIssue({ code: "custom", path: ["pricePaise"], message: "Enter a price" });
  });
export type ServiceInput = z.infer<typeof serviceSchema>;

/** Onboarding Step 3 quick service (name, short description, price type + price). */
export const starterServiceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    shortDescription: optionalText(300),
    priceType: z.enum(PRICE_TYPES).default("ON_REQUEST"),
    pricePaise: z.number().int().nonnegative().max(1_000_000_000).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (priceTypeNeedsAmount(v.priceType) && v.pricePaise == null) ctx.addIssue({ code: "custom", path: ["pricePaise"], message: "Enter a price" });
  });
export const starterServicesSchema = z.array(starterServiceSchema).max(3, "Add up to 3 services");

export const pageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: optionalSlug.refine((s) => !s || !RESERVED_PAGE_SLUGS.has(s), "That address is reserved. Pick another."),
  isPublished: bool.default(true),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});
export type PageInput = z.infer<typeof pageSchema>;

export const pageSectionsSchema = z.object({ sections: sectionsSchema });

export const galleryItemSchema = z.object({
  imagePath: z.string().trim().max(500).regex(/^tenant\/[0-9a-f-]{36}\/[^\s]+$/, "Upload an image"),
  caption: optionalText(200),
  alt: optionalText(200),
  album: optionalText(60),
});
export type GalleryItemInput = z.infer<typeof galleryItemSchema>;

export const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "Add a name").max(80),
  role: optionalText(80),
  bio: optionalText(1000),
  photoPath: storagePath,
  isVisible: bool.default(true),
});
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(1, "Add a name").max(80),
  authorPhotoPath: storagePath,
  rating: intWithDefault(1, 5, 5),
  text: z.string().trim().min(1, "Add the testimonial").max(1000),
  isVisible: bool.default(true),
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const faqSchema = z.object({
  question: z.string().trim().min(1, "Add a question").max(300),
  answer: z.string().trim().min(1, "Add an answer").max(3000),
  isVisible: bool.default(true),
});
export type FaqInput = z.infer<typeof faqSchema>;

export const reorderSchema = z.object({ ids: z.array(uuid).min(1).max(500) }).refine((v) => new Set(v.ids).size === v.ids.length, "Duplicate ids");

// ---- Enquiries -------------------------------------------------------------------------------

export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_SOURCES = ["CONTACT_FORM", "SERVICE_PAGE", "WHATSAPP_CLICK"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const enquiryUpdateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  notes: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(5000).optional()),
});

export const enquiryFilterSchema = z.object({
  status: z.preprocess(blankToUndefined, z.enum(ENQUIRY_STATUSES).optional()),
  serviceId: z.preprocess(blankToUndefined, uuid.optional()),
  from: z.preprocess(blankToUndefined, z.iso.date().optional()),
  to: z.preprocess(blankToUndefined, z.iso.date().optional()),
  page: intWithDefault(1, 10_000, 1),
});
export type EnquiryFilter = z.infer<typeof enquiryFilterSchema>;
