import { z } from "zod";
import { PRICE_TYPES, type PriceType } from "../pricing";

/**
 * Informative Website AI (M9): the JSON the model returns, and the pure mapping from an approved
 * proposal to panel writes (unit tested). Model text is trimmed and capped rather than rejected,
 * so a slightly long answer is still usable; the panel schemas re-validate on apply.
 */

const text = (max: number) => z.string().transform((s) => s.replace(/\s+/g, " ").trim().slice(0, max));
const longText = (max: number) => z.string().transform((s) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max));

export const aiServiceSchema = z.object({
  name: text(120).pipe(z.string().min(1)),
  shortDescription: text(300).default(""),
  description: longText(2000).default(""),
  priceType: z.enum(PRICE_TYPES).catch("ON_REQUEST"),
  /** Rupees as the model writes them; converted to integer paise on apply. */
  priceRupees: z.number().nonnegative().max(10_000_000).nullable().catch(null).default(null),
  durationMinutes: z.number().int().min(1).max(1440).nullable().catch(null).default(null),
});
export type AiService = z.output<typeof aiServiceSchema>;

export const aiFaqSchema = z.object({ question: text(300).pipe(z.string().min(1)), answer: longText(1500).pipe(z.string().min(1)) });
export type AiFaq = z.output<typeof aiFaqSchema>;

/** Whole-site build (onboarding, "Rebuild my website"). */
export const siteBuildSchema = z.object({
  tagline: text(120),
  about: longText(3000).pipe(z.string().min(1)),
  services: z.array(aiServiceSchema).max(6).default([]),
  faqs: z.array(aiFaqSchema).max(8).default([]),
  seoTitle: text(70).default(""),
  seoDescription: text(160).default(""),
});
export type SiteBuild = z.output<typeof siteBuildSchema>;

export const proposalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("site_copy"), tagline: text(120).optional(), about: longText(3000).optional() }),
  z.object({ kind: z.literal("services"), services: z.array(aiServiceSchema).min(1).max(6) }),
  z.object({ kind: z.literal("faqs"), faqs: z.array(aiFaqSchema).min(1).max(8) }),
  z.object({ kind: z.literal("seo"), title: text(70), description: text(160) }),
]);
export type Proposal = z.output<typeof proposalSchema>;
export type ProposalKind = Proposal["kind"];

export const ASSISTANT_MAX_TURNS = 12;

export const assistantReplySchema = z.object({
  reply: longText(2000).pipe(z.string().min(1)),
  proposals: z.array(z.unknown()).max(4).default([])
    // Keep the valid proposals; drop malformed ones instead of failing the whole answer.
    .transform((items) => items.flatMap((p) => {
      const r = proposalSchema.safeParse(p);
      return r.success ? [r.data] : [];
    })),
});
export type AssistantReply = z.output<typeof assistantReplySchema>;

export const assistantChatInputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(ASSISTANT_MAX_TURNS)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be yours"),
});
export type AssistantChatInput = z.infer<typeof assistantChatInputSchema>;

export const applyProposalInputSchema = z.object({ proposal: proposalSchema });

// ---- Pure mapping: proposal → writes --------------------------------------------------------

export type ServiceWrite = { name: string; shortDescription: string | null; description: string | null; priceType: PriceType; pricePaise: number | null; durationMinutes: number | null };
export type ProposalWrites = {
  site?: { tagline?: string | null; about?: string | null };
  services?: ServiceWrite[];
  faqs?: { question: string; answer: string }[];
  seo?: { title: string | null; description: string | null };
};

/** Prices need an amount for FIXED / STARTING_FROM; without one the service becomes "on request". */
export function toServiceWrite(s: AiService): ServiceWrite {
  const pricePaise = s.priceRupees == null ? null : Math.round(s.priceRupees * 100);
  const needsAmount = s.priceType === "FIXED" || s.priceType === "STARTING_FROM";
  return {
    name: s.name,
    shortDescription: s.shortDescription || null,
    description: s.description || null,
    priceType: needsAmount && pricePaise == null ? "ON_REQUEST" : s.priceType,
    pricePaise: needsAmount ? pricePaise : null,
    durationMinutes: s.durationMinutes,
  };
}

export function proposalWrites(p: Proposal): ProposalWrites {
  switch (p.kind) {
    case "site_copy":
      return { site: { ...(p.tagline !== undefined ? { tagline: p.tagline || null } : {}), ...(p.about !== undefined ? { about: p.about || null } : {}) } };
    case "services":
      return { services: p.services.map(toServiceWrite) };
    case "faqs":
      return { faqs: p.faqs.map((f) => ({ question: f.question, answer: f.answer })) };
    case "seo":
      return { seo: { title: p.title || null, description: p.description || null } };
  }
}

/** Short human label for a proposal card. */
export function proposalTitle(p: Proposal): string {
  switch (p.kind) {
    case "site_copy":
      return p.about && p.tagline ? "New tagline and About text" : p.about ? "New About text" : "New tagline";
    case "services":
      return `Add ${p.services.length} service${p.services.length === 1 ? "" : "s"}`;
    case "faqs":
      return `Add ${p.faqs.length} FAQ${p.faqs.length === 1 ? "" : "s"}`;
    case "seo":
      return "Search engine title and description";
  }
}
