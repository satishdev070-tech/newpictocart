import { z } from "zod";
import { isIndustry } from "@/features/stores/industries";
import { SITE_MODES } from "@/features/stores/site-mode";
import { isSarvamLocaleCode } from "@/lib/sarvam/locales";

export const voiceFactsSchema = z.object({
  name: z.string().trim().min(2).max(120).nullable().optional(),
  category: z.string().nullable().optional(),
  siteMode: z.enum(SITE_MODES).nullable().optional(),
  tagline: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
});

/** Structured JSON Tara returns each turn (plus a spoken reply). */
export const taraTurnResultSchema = z.object({
  reply: z.string().trim().min(1).max(800),
  facts: z
    .object({
      name: z.string().trim().min(1).max(120).nullable().optional(),
      category: z.string().trim().min(1).max(80).nullable().optional(),
      siteMode: z.string().trim().min(1).max(40).nullable().optional(),
      tagline: z.string().trim().max(160).nullable().optional(),
      city: z.string().trim().max(80).nullable().optional(),
    })
    .default({}),
  done: z.boolean().default(false),
});

export type TaraTurnResult = z.infer<typeof taraTurnResultSchema>;

export const voiceTurnInputSchema = z.object({
  locale: z.string().refine(isSarvamLocaleCode, "Choose a supported language"),
  /** Prior facts JSON string from the client. */
  factsJson: z.string().max(4000).optional(),
  /** Optional typed message when the seller falls back from mic. */
  text: z.string().trim().max(1000).optional(),
  /** Audio blob from MediaRecorder (webm/ogg/wav). */
  audio: z.any().optional(),
});

export const confirmVoiceBusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  category: z.string().refine(isIndustry, "Choose the category that fits your business best"),
  slug: z.string().trim().toLowerCase().min(3).max(63),
  siteMode: z.enum(SITE_MODES),
  tagline: z.string().trim().max(160).optional(),
  locale: z.string().refine(isSarvamLocaleCode).optional(),
  plan: z.string().optional(),
  theme: z.string().optional(),
});
