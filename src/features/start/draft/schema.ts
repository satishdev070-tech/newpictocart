import { z } from "zod";
import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { SITE_MODES, DEFAULT_SITE_MODE, type SiteMode } from "@/features/stores/site-mode";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { isStartIntentId, type StartIntentId } from "../intents";
import { isThemeKey } from "@/features/marketing-site/themes";

export const START_DRAFT_STORAGE_KEY = "pictocart.start.draft.v1";
export const START_DRAFT_COOKIE = "pc_start_draft";

export const START_SCREENS = [
  "welcome",
  "lang",
  "intent",
  "path",
  "voice",
  "quiz",
  "business",
  "products",
  "mood",
  "payment",
  "building",
  "account",
  "done",
] as const;

export type StartScreen = (typeof START_SCREENS)[number];

const voiceFactsSchema = z.object({
  name: z.string().max(120).nullable(),
  category: z.string().nullable(),
  siteMode: z.enum(SITE_MODES).nullable(),
  tagline: z.string().max(160).nullable(),
  city: z.string().max(80).nullable(),
});

const voiceTurnSchema = z.object({
  role: z.enum(["seller", "tara"]),
  text: z.string().max(800),
});

export type StartVoiceTurn = z.infer<typeof voiceTurnSchema>;

const productSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().max(160),
  pricePaise: z.number().int().min(0).max(100_000_000),
});

const paymentSchema = z.object({
  upi: z.string().max(120),
  cod: z.boolean(),
  shipping: z.enum(["free-over", "flat", "courier"]),
});

export const startDraftSchema = z.object({
  v: z.literal(1),
  screen: z.enum(START_SCREENS),
  locale: z.string().refine(isSarvamLocaleCode),
  intent: z
    .string()
    .nullable()
    .refine((v) => v === null || isStartIntentId(v)),
  path: z.enum(["ai", "manual"]).nullable(),
  voice: z.object({
    facts: voiceFactsSchema,
    done: z.boolean(),
    /** Recent Tara conversation. Missing on drafts saved before chat history existed. */
    turns: z.array(voiceTurnSchema).max(12).optional().default([]),
    /** How the seller is answering Tara. Missing on drafts saved before the quiz. */
    mode: z.enum(["talk", "quiz"]).optional().default("talk"),
  }),
  business: z.object({
    name: z.string().max(120),
    tagline: z.string().max(160),
    category: z
      .string()
      .nullable()
      .refine((v) => v === null || isIndustry(v)),
    city: z.string().max(80),
    whatsapp: z.string().max(20),
    siteMode: z.enum(SITE_MODES),
  }),
  products: z.array(productSchema).max(12),
  mood: z.string().max(40).nullable(),
  accent: z.string().max(20).nullable(),
  payment: paymentSchema,
  plan: z.string().max(40).nullable(),
  theme: z.string().max(80).nullable(),
  result: z
    .object({
      slug: z.string(),
      name: z.string(),
    })
    .nullable(),
});

export type StartDraft = z.infer<typeof startDraftSchema>;
export type StartDraftProduct = z.infer<typeof productSchema>;

export function emptyStartDraft(overrides?: Partial<Pick<StartDraft, "plan" | "theme" | "locale">>): StartDraft {
  return {
    v: 1,
    screen: "welcome",
    locale: overrides?.locale ?? "en-IN",
    intent: null,
    path: null,
    voice: {
      facts: { name: null, category: null, siteMode: null, tagline: null, city: null },
      done: false,
      turns: [],
      mode: "talk",
    },
    business: {
      name: "",
      tagline: "",
      category: null,
      city: "",
      whatsapp: "",
      siteMode: DEFAULT_SITE_MODE,
    },
    products: [],
    mood: null,
    accent: null,
    payment: { upi: "", cod: true, shipping: "free-over" },
    plan: overrides?.plan ?? null,
    theme: overrides?.theme ?? null,
    result: null,
  };
}

export function parseStartDraft(raw: unknown): StartDraft | null {
  const parsed = startDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function draftCategory(draft: StartDraft): IndustrySlug | null {
  const b = draft.business.category;
  if (b && isIndustry(b)) return b;
  const v = draft.voice.facts.category;
  if (v && isIndustry(v)) return v as IndustrySlug;
  return null;
}

export function draftStoreName(draft: StartDraft): string {
  const n = draft.business.name.trim() || draft.voice.facts.name?.trim() || "";
  return n;
}

export function draftSiteMode(draft: StartDraft): SiteMode {
  return draft.business.siteMode ?? draft.voice.facts.siteMode ?? DEFAULT_SITE_MODE;
}

export function normalizeThemeKey(theme: string | null): string | null {
  if (!theme || !isThemeKey(theme)) return null;
  return theme;
}

export type { SarvamLocaleCode, StartIntentId };
