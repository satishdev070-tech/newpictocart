/**
 * "Ask Pictocart AI" input / model-output schemas (pure, unit tested). Inputs are strict; model
 * output is lenient (bad proposals are dropped, never fail the whole answer).
 */
import { z } from "zod";
import { AGENT_LINKS, type AgentLinkKey, faqProposalItemSchema } from "../schemas";
import { COPILOT_LANGUAGES } from "./languages";
import { INFORMATIVE_INTENTS, STORE_INTENTS } from "./quick-actions";
import { copilotTopicSchema } from "./scope";
import { blogApplySchema, blogModelSchema, priceApplySchema, priceModelSchema, statusApplySchema, statusModelSchema, stockApplySchema, stockModelSchema } from "./actions-plan";

export const COPILOT_MAX_MESSAGES = 16;

const chatMessages = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
  .min(1)
  .max(COPILOT_MAX_MESSAGES)
  .refine((m) => m[0]?.role === "user", "The conversation must start with your message")
  .refine((m) => m[m.length - 1]?.role === "user", "The last message must be yours");

export const storeCopilotAskSchema = z.object({
  messages: chatMessages,
  language: z.enum(COPILOT_LANGUAGES).catch("en").default("en"),
  intent: z.enum(STORE_INTENTS).nullable().optional(),
});
export type StoreCopilotAsk = z.infer<typeof storeCopilotAskSchema>;

export const informativeCopilotAskSchema = z.object({
  messages: chatMessages,
  language: z.enum(COPILOT_LANGUAGES).catch("en").default("en"),
  intent: z.enum(INFORMATIVE_INTENTS).nullable().optional(),
});
export type InformativeCopilotAsk = z.infer<typeof informativeCopilotAskSchema>;

// ---- Store model output ---------------------------------------------------------------------

const capped = (max: number) => z.string().transform((s) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max));

const productCopyModelSchema = z.object({
  type: z.literal("product_copy"),
  productTitle: capped(200).pipe(z.string().min(1)),
  description: capped(5000).optional(),
  shortDescription: capped(500).optional(),
  seoTitle: capped(120).optional(),
  seoDescription: capped(320).optional(),
});
const faqModelSchema = z.object({
  type: z.literal("faq"),
  groupName: z.string().trim().min(1).max(60).catch("General").default("General"),
  items: z.array(faqProposalItemSchema).min(1).max(8),
});
export const storeModelProposalSchema = z.discriminatedUnion("type", [faqModelSchema, productCopyModelSchema, stockModelSchema, priceModelSchema, statusModelSchema, blogModelSchema]);
export type StoreModelProposal = z.infer<typeof storeModelProposalSchema>;

function linkList<K extends string>(table: Record<K, string>) {
  return z
    .array(z.object({ key: z.string(), label: z.string().trim().min(1).max(60) }))
    .max(6)
    .catch([])
    .default([])
    .transform((links) => {
      const seen = new Set<string>();
      const out: { label: string; href: string }[] = [];
      for (const l of links) {
        if (!(l.key in table) || seen.has(l.key)) continue;
        seen.add(l.key);
        out.push({ label: l.label, href: table[l.key as K] });
      }
      return out.slice(0, 4);
    });
}

/** Most steps one reply may plan (each is previewed and confirmed). */
export const MAX_PLAN_STEPS = 6;

const keepValid = <S extends z.ZodType>(schema: S) =>
  z
    .array(z.unknown())
    .max(MAX_PLAN_STEPS)
    .catch([])
    .default([])
    .transform((items) =>
      items.flatMap((p) => {
        const r = schema.safeParse(p);
        return r.success ? [r.data as z.output<S>] : [];
      }),
    );

export const storeCopilotReplySchema = z.object({
  topic: copilotTopicSchema,
  answer: capped(3000).pipe(z.string().min(1)),
  links: linkList<AgentLinkKey>(AGENT_LINKS),
  proposals: keepValid(storeModelProposalSchema),
});

// ---- Informative model output ---------------------------------------------------------------

export const INFORMATIVE_LINKS = {
  dashboard: "/informative/dashboard",
  business: "/informative/business",
  services: "/informative/services",
  pages: "/informative/pages",
  gallery: "/informative/gallery",
  team: "/informative/team",
  testimonials: "/informative/testimonials",
  faqs: "/informative/faqs",
  enquiries: "/informative/enquiries",
  seo: "/informative/seo",
  appearance: "/informative/appearance",
  domain: "/informative/domain",
  settings: "/informative/settings",
} as const;
export type InformativeLinkKey = keyof typeof INFORMATIVE_LINKS;
export const INFORMATIVE_LINK_KEYS = Object.keys(INFORMATIVE_LINKS) as InformativeLinkKey[];

export const informativeLinksSchema = linkList<InformativeLinkKey>(INFORMATIVE_LINKS);

// ---- Store apply (payload comes back from the client: re-validated here) --------------------

export const productCopyApplySchema = z
  .object({
    type: z.literal("product_copy"),
    productId: z.uuid(),
    description: z.string().trim().min(1).max(5000).optional(),
    shortDescription: z.string().trim().min(1).max(500).optional(),
    seoTitle: z.string().trim().min(1).max(120).optional(),
    seoDescription: z.string().trim().min(1).max(320).optional(),
  })
  .refine((p) => p.description || p.shortDescription || p.seoTitle || p.seoDescription, "Nothing to apply");

export const storeApplySchema = z.union([
  z.object({ type: z.literal("faq"), groupName: z.string().trim().min(1).max(60).default("General"), items: z.array(faqProposalItemSchema).min(1).max(8) }),
  productCopyApplySchema,
  stockApplySchema,
  priceApplySchema,
  statusApplySchema,
  blogApplySchema,
]);
export type StoreApplyPayload = z.infer<typeof storeApplySchema>;

// ---- Voice ----------------------------------------------------------------------------------

/** ~30 s of Opus/AAC push-to-talk is well under this. */
export const VOICE_MAX_BYTES = 1_500_000;
export const VOICE_MIN_BYTES = 200;
export const VOICE_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac"] as const;

export type VoiceUpload = { audio: Blob; filename: string; language: (typeof COPILOT_LANGUAGES)[number] };

/**
 * Validates the push-to-talk FormData (audio file + language). Throws a zod-like issue list via
 * the returned result so the action can map it to a VALIDATION AppError.
 */
export function parseVoiceForm(fd: FormData): { ok: true; value: VoiceUpload } | { ok: false; field: "audio" | "language"; message: string } {
  const lang = fd.get("language");
  const language = typeof lang === "string" ? lang.trim().toLowerCase() : "";
  if (!(COPILOT_LANGUAGES as readonly string[]).includes(language)) return { ok: false, field: "language", message: "Choose a supported language." };
  const audio = fd.get("audio");
  if (!(audio instanceof Blob)) return { ok: false, field: "audio", message: "No recording received. Try again." };
  if (audio.size < VOICE_MIN_BYTES) return { ok: false, field: "audio", message: "That recording was too short. Hold the mic and speak." };
  if (audio.size > VOICE_MAX_BYTES) return { ok: false, field: "audio", message: "That recording is too long. Keep it under 30 seconds." };
  const mime = (audio.type || "").split(";")[0]!.trim().toLowerCase();
  if (!(VOICE_MIME_TYPES as readonly string[]).includes(mime)) return { ok: false, field: "audio", message: "That audio format isn't supported." };
  const ext = mime === "audio/mp4" || mime === "audio/aac" ? "mp4" : mime === "audio/ogg" ? "ogg" : mime === "audio/mpeg" ? "mp3" : mime.includes("wav") ? "wav" : "webm";
  return { ok: true, value: { audio, filename: `copilot.${ext}`, language: language as VoiceUpload["language"] } };
}

export const speakInputSchema = z.object({
  text: z.string().trim().min(1).max(2400),
  language: z.enum(COPILOT_LANGUAGES),
});
