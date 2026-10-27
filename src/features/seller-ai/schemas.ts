/**
 * Seller AI Phase 2 contracts (blog write + contact reply drafts).
 * Shared edge meta helpers are safe for Phase 1 product-generate to reuse.
 * Pure module — safe for client and server.
 */
import { z } from "zod";

export const SELLER_AI_KINDS = ["generate_blog", "draft_contact_reply"] as const;
export type SellerAiKind = (typeof SELLER_AI_KINDS)[number];

const text = (max: number) => z.string().trim().min(1).max(max);
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Edge function envelope fields (provider/model are echoed for logging). */
export const sellerAiEdgeMeta = z.object({
  provider: z.enum(["gemini", "groq", "anthropic"]),
  model: z.string().trim().min(1).max(100),
  tokens: z.number().finite().nullable().optional(),
});

/** AI-authored content blocks only (no images / buttons — those stay manual). */
export const sellerAiBlogBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2), text: text(200) }),
  z.object({ type: z.literal("paragraph"), text: text(5000) }),
  z.object({
    type: z.literal("list"),
    style: z.enum(["bullet", "number"]).default("bullet"),
    items: z.array(text(500)).min(1).max(50),
  }),
  z.object({ type: z.literal("quote"), text: text(1000), cite: z.string().trim().max(120).optional() }),
]);

export const generateBlogDraftSchema = z.object({
  title: text(200),
  slug: z.string().trim().max(120).default(""),
  excerpt: z.string().trim().max(500).default(""),
  seoTitle: z.string().trim().max(120).default(""),
  seoDescription: z.string().trim().max(320).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  blocks: z.array(sellerAiBlogBlockSchema).min(2).max(20),
});
export type GenerateBlogDraft = z.infer<typeof generateBlogDraftSchema>;
export const generateBlogEdgeResponse = generateBlogDraftSchema.merge(sellerAiEdgeMeta);

export const contactReplyDraftSchema = z.object({
  subject: z.string().trim().max(200).default(""),
  reply: text(4000),
});
export type ContactReplyDraft = z.infer<typeof contactReplyDraftSchema>;
export const contactReplyEdgeResponse = contactReplyDraftSchema.merge(sellerAiEdgeMeta);

export const generateBlogInput = z.object({
  topic: z.string().trim().min(3, "Describe the post in a few words").max(300, "Keep the topic under 300 characters"),
  tone: z.preprocess(blank, z.string().trim().max(80).optional()),
  language: z.preprocess(blank, z.string().trim().max(40).optional()),
});

export const contactReplyInput = z.object({
  messageId: z.uuid(),
});
