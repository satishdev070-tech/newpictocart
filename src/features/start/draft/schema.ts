import { z } from "zod";
import { isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { isSubcategory } from "@/features/stores/subcategories";
import { SITE_MODES, DEFAULT_SITE_MODE, type SiteMode } from "@/features/stores/site-mode";
import { isSarvamLocaleCode, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { isStartIntentId, type StartIntentId } from "../intents";
import { isThemeKey } from "@/features/marketing-site/themes";

export const START_DRAFT_STORAGE_KEY = "pictocart.start.draft.v1";
export const START_DRAFT_COOKIE = "pc_start_draft";

/** Canonical + legacy screen ids (legacy kept for parse / in-flight journey compat). */
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
  "theme",
  "building",
  "account",
  "done",
] as const;

export type StartScreen = (typeof START_SCREENS)[number];

const voiceFactsSchema = z.object({
  name: z.string().max(120).nullable(),
  category: z.string().nullable(),
  subcategory: z.string().max(80).nullable(),
  productsServices: z.string().max(300).nullable(),
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
  v: z.literal(2),
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
    subcategory: z.string().max(80).nullable(),
    productsServices: z.string().max(300),
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

const LEGACY_SCREEN_MAP: Partial<Record<StartScreen, StartScreen>> = {
  welcome: "lang",
  intent: "path",
  products: "business",
  mood: "theme",
  payment: "theme",
  voice: "business",
  quiz: "business",
};

function remapScreen(screen: unknown): StartScreen {
  if (typeof screen !== "string" || !(START_SCREENS as readonly string[]).includes(screen)) {
    return "lang";
  }
  const s = screen as StartScreen;
  return LEGACY_SCREEN_MAP[s] ?? s;
}

/** Lift a v1 draft object to v2 shape (fields + screen remap). */
function migrateV1ToV2(raw: Record<string, unknown>): unknown {
  const voice = (raw.voice && typeof raw.voice === "object" ? raw.voice : {}) as Record<string, unknown>;
  const facts = (voice.facts && typeof voice.facts === "object" ? voice.facts : {}) as Record<string, unknown>;
  const business = (raw.business && typeof raw.business === "object" ? raw.business : {}) as Record<string, unknown>;

  return {
    ...raw,
    v: 2,
    screen: remapScreen(raw.screen),
    voice: {
      ...voice,
      facts: {
        name: facts.name ?? null,
        category: facts.category ?? null,
        subcategory: facts.subcategory ?? null,
        productsServices: facts.productsServices ?? null,
        siteMode: facts.siteMode ?? null,
        tagline: facts.tagline ?? null,
        city: facts.city ?? null,
      },
    },
    business: {
      ...business,
      subcategory: business.subcategory ?? null,
      productsServices: typeof business.productsServices === "string" ? business.productsServices : "",
    },
  };
}

export function emptyStartDraft(overrides?: Partial<Pick<StartDraft, "plan" | "theme" | "locale">>): StartDraft {
  return {
    v: 2,
    screen: "lang",
    locale: overrides?.locale ?? "en-IN",
    intent: null,
    path: null,
    voice: {
      facts: {
        name: null,
        category: null,
        subcategory: null,
        productsServices: null,
        siteMode: null,
        tagline: null,
        city: null,
      },
      done: false,
      turns: [],
      mode: "talk",
    },
    business: {
      name: "",
      tagline: "",
      category: null,
      subcategory: null,
      productsServices: "",
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
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidate = obj.v === 1 ? migrateV1ToV2(obj) : raw;
  const parsed = startDraftSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function draftCategory(draft: StartDraft): IndustrySlug | null {
  const b = draft.business.category;
  if (b && isIndustry(b)) return b;
  const v = draft.voice.facts.category;
  if (v && isIndustry(v)) return v as IndustrySlug;
  return null;
}

export function draftSubcategory(draft: StartDraft): string | null {
  const industry = draftCategory(draft);
  const fromBusiness = draft.business.subcategory?.trim() || null;
  const fromVoice = draft.voice.facts.subcategory?.trim() || null;
  for (const slug of [fromBusiness, fromVoice]) {
    if (!slug) continue;
    if (industry) {
      if (isSubcategory(industry, slug)) return slug;
      continue;
    }
    return slug;
  }
  return null;
}

export function draftStoreName(draft: StartDraft): string {
  const n = draft.business.name.trim() || draft.voice.facts.name?.trim() || "";
  return n;
}

export function draftSiteMode(draft: StartDraft): SiteMode {
  return draft.business.siteMode ?? draft.voice.facts.siteMode ?? DEFAULT_SITE_MODE;
}

export function draftProductsServices(draft: StartDraft): string {
  return (
    draft.business.productsServices.trim() ||
    draft.voice.facts.productsServices?.trim() ||
    ""
  );
}

export function normalizeThemeKey(theme: string | null): string | null {
  if (!theme || !isThemeKey(theme)) return null;
  return theme;
}

export type { SarvamLocaleCode, StartIntentId };
