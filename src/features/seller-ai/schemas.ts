import { z } from "zod";
import { contentBlockSchema } from "@/features/content/blocks";

const httpsUrl = z.string().url().refine((u) => u.startsWith("https://"), "Image URLs must be https");

export const generateProductInputSchema = z.object({
  imageUrls: z.array(httpsUrl).max(4).default([]),
  hint: z.string().trim().max(500).optional(),
  locale: z.string().trim().max(40).optional(),
});

/** LLM JSON only — provider/model/tokens are attached by the server after generateJson. */
export const generateProductContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000),
  shortDescription: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  priceMinor: z.number().int().min(0).max(99_999_999_00),
  productTypeHint: z.string().trim().max(60).nullable().optional(),
  categoryHint: z.string().trim().max(80).nullable().optional(),
  seoTitle: z.string().trim().max(120).optional().default(""),
  seoDescription: z.string().trim().max(320).optional().default(""),
});

const generationMetaSchema = z.object({
  provider: z.enum(["gemini", "groq", "anthropic"]),
  model: z.string().max(100),
  tokens: z.number().nullable().optional(),
});

export const generateProductResultSchema = generateProductContentSchema.merge(generationMetaSchema);
export type GenerateProductResult = z.infer<typeof generateProductResultSchema>;

export const generateBlogInputSchema = z.object({
  topic: z.string().trim().min(3, "Enter a topic").max(300),
  locale: z.string().trim().max(40).optional(),
});

const blogBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2), text: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("list"), style: z.enum(["bullet", "number"]).default("bullet"), items: z.array(z.string().trim().min(1).max(500)).min(1).max(50) }),
  z.object({ type: z.literal("quote"), text: z.string().trim().min(1).max(1000), cite: z.string().trim().max(120).optional() }),
]);

export const generateBlogContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(320),
  blocks: z.array(blogBlockSchema).min(1).max(20),
});
export const generateBlogResultSchema = generateBlogContentSchema.merge(generationMetaSchema);
export type GenerateBlogResult = z.infer<typeof generateBlogResultSchema>;

/** Soften AI blocks into store content blocks (drops invalid ones). */
export function toContentBlocks(blocks: z.infer<typeof blogBlockSchema>[]) {
  const out: z.infer<typeof contentBlockSchema>[] = [];
  for (const b of blocks) {
    const r = contentBlockSchema.safeParse(b);
    if (r.success) out.push(r.data);
  }
  return out;
}

export const contactReplyInputSchema = z.object({
  messageId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(2).max(4000),
});

export const contactReplyContentSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  subject: z.string().trim().max(200),
});
export const contactReplyResultSchema = contactReplyContentSchema.merge(generationMetaSchema);
export type ContactReplyResult = z.infer<typeof contactReplyResultSchema>;

export const businessCoachContentSchema = z.object({
  headline: z.string().trim().min(1).max(120),
  focus: z.string().trim().max(280),
  tips: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        detail: z.string().trim().min(1).max(320),
        priority: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1)
    .max(6),
});
export const businessCoachResultSchema = businessCoachContentSchema.merge(generationMetaSchema);
export type BusinessCoachResult = z.infer<typeof businessCoachResultSchema>;

export const SELLER_AI_CREDIT_KINDS = ["generate_product", "generate_blog", "contact_reply", "business_coach"] as const;
export type SellerAiCreditKind = (typeof SELLER_AI_CREDIT_KINDS)[number];

export const SELLER_AI_KIND_LABELS: Record<SellerAiCreditKind, string> = {
  generate_product: "Product from image",
  generate_blog: "Blog AI Write",
  contact_reply: "Contact reply draft",
  business_coach: "Business coach",
};
