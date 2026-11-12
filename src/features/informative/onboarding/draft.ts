import { z } from "zod";
import { email, indianMobile } from "@/lib/validation/common";
import { isValidStoreSlug } from "@/lib/tenant/host";
import { INFO_CATEGORY_IDS } from "../categories";
import { PRICE_TYPES } from "../pricing";

/**
 * Informative onboarding draft (pure; client + server). Kept in its OWN localStorage key so the
 * store journey's draft (pictocart.start.draft.v1) is never touched. The server re-validates
 * everything at completion; nothing here is trusted.
 */
export const START_TYPE_KEY = "pictocart.start.type.v1";
export const INFO_DRAFT_KEY = "pictocart.start.informative.v1";
/** sessionStorage key the theme preview iframe reads the user's logo from (same origin). */
export const INFO_PREVIEW_LOGO_KEY = "pictocart.start.informative.logo";

export const INFO_STEPS = ["basic-info", "theme", "services", "account", "finish"] as const;
export type InfoStep = (typeof INFO_STEPS)[number];
export const isInfoStep = (s: string): s is InfoStep => (INFO_STEPS as readonly string[]).includes(s);

/** Logo after client-side downscaling (≤ 512 px). Original upload is limited to 2 MB, no SVG. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export const storeSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(63)
  .refine((s) => isValidStoreSlug(s), "Use lowercase letters, numbers and single hyphens (some words are reserved)");

/** Step 1 (plan table): name 2–80, category, tagline ≤ 120, phone, WhatsApp (same as phone), email, city, address, slug. */
export const basicInfoStepSchema = z.object({
  businessName: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  category: z.enum(INFO_CATEGORY_IDS, { error: "Choose a category" }),
  /** Picked service type id (service-types.ts), or "custom" when the person typed their own. */
  serviceTypeId: z.string().trim().max(40).default(""),
  /** Service label shown to the AI and stored in info_sites.service_type (≤ 60). */
  serviceType: z.string().trim().max(60, "At most 60 characters").default(""),
  tagline: z.string().trim().max(120, "At most 120 characters").default(""),
  phone: indianMobile,
  whatsappSameAsPhone: z.boolean().default(true),
  whatsapp: z.string().trim().max(20).default(""),
  email: email,
  city: z.string().trim().min(2, "Enter your city").max(80),
  address: z.string().trim().max(300).default(""),
  slug: storeSlug,
}).superRefine((v, ctx) => {
  if (v.serviceTypeId === "custom" && v.serviceType.length < 2) {
    ctx.addIssue({ code: "custom", path: ["serviceType"], message: "Tell us what service you offer" });
  }
  if (!v.whatsappSameAsPhone && v.whatsapp && !indianMobile.safeParse(v.whatsapp).success) {
    ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Enter a valid 10-digit Indian mobile number" });
  }
});
export type BasicInfoStep = z.infer<typeof basicInfoStepSchema>;

export const draftServiceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().max(300).default(""),
  priceType: z.enum(PRICE_TYPES).default("ON_REQUEST"),
  pricePaise: z.number().int().nonnegative().max(1_000_000_000).nullable().default(null),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

/** Starter services at onboarding (the completion RPC accepts up to 6). */
export const MAX_DRAFT_SERVICES = 6;

/** The whole draft as stored in the browser (lenient: partial while the user is on early steps). */
export const informativeDraftSchema = z.object({
  v: z.literal(1),
  basic: z.record(z.string(), z.unknown()).default({}),
  logoDataUrl: z.string().max(700_000).regex(LOGO_DATA_URL_RE).nullable().default(null),
  themeId: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable().default(null),
  services: z.array(draftServiceSchema).max(MAX_DRAFT_SERVICES).default([]),
  servicesSkipped: z.boolean().default(false),
  /** Service type the starter services were filled from; null once the person edits them. */
  seededFrom: z.string().max(40).nullable().default(null),
});
export type InformativeDraft = z.infer<typeof informativeDraftSchema>;

export const EMPTY_DRAFT: InformativeDraft = { v: 1, basic: {}, logoDataUrl: null, themeId: null, services: [], servicesSkipped: false, seededFrom: null };

/**
 * After Step 1: fill the starter services from the chosen service type, unless the person already
 * wrote their own. Re-fills when they switch type while the list is still the untouched seed.
 */
export function withSeededServices(d: InformativeDraft, typeId: string, seed: InformativeDraft["services"] | null): InformativeDraft {
  if (!seed?.length) return d;
  const untouched = d.services.length === 0 || d.seededFrom !== null;
  if (!untouched || d.seededFrom === typeId) return d;
  return { ...d, services: seed.slice(0, MAX_DRAFT_SERVICES), servicesSkipped: false, seededFrom: typeId };
}

export function parseDraft(raw: unknown): InformativeDraft {
  const r = informativeDraftSchema.safeParse(raw);
  return r.success ? r.data : { ...EMPTY_DRAFT };
}

/** Completion input (server): every step must be valid. */
export const completeDraftSchema = z.object({
  v: z.literal(1),
  basic: basicInfoStepSchema,
  logoDataUrl: z.string().max(700_000).regex(LOGO_DATA_URL_RE, "Logo must be PNG, JPG or WebP").nullable().default(null),
  themeId: z.string().regex(/^[a-z0-9-]{2,40}$/, "Choose a theme"),
  services: z.array(draftServiceSchema).max(MAX_DRAFT_SERVICES, `Add up to ${MAX_DRAFT_SERVICES} services`).default([]),
  servicesSkipped: z.boolean().default(false),
});
export type CompleteDraft = z.infer<typeof completeDraftSchema>;

/**
 * May the person open `step` with this draft? Steps can't be skipped; "finish" follows "account"
 * because signing in completes the account step (the server sends signed-out visitors back).
 */
export function canOpenStep(step: InfoStep, d: InformativeDraft): boolean {
  const first = resumeStep(d);
  if (step === "finish") return first === "account";
  return INFO_STEPS.indexOf(step) <= INFO_STEPS.indexOf(first);
}

/** The step a draft should resume at (first incomplete step). */
export function resumeStep(d: InformativeDraft): InfoStep {
  if (!basicInfoStepSchema.safeParse(d.basic).success) return "basic-info";
  if (!d.themeId) return "theme";
  if (!d.services.length && !d.servicesSkipped) return "services";
  return "account";
}
