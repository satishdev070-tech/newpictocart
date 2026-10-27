import { z } from "zod";

/** Credit kind + ai_feature_routes / ledger note for Product Generate with AI. */
export const GENERATE_PRODUCT_CREDIT_KIND = "generate_product" as const;

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Image URL must be http(s)");

const base64ImageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  /** Raw base64 without data: prefix; capped ~4MB decoded. */
  data: z.string().min(32).max(5_500_000),
});

export const generateProductInputSchema = z
  .object({
    imageUrls: z.array(httpUrl).max(4).default([]),
    images: z.array(base64ImageSchema).max(4).default([]),
    hints: z
      .object({
        title: z.string().trim().max(120).optional(),
        category: z.string().trim().max(80).optional(),
        brand: z.string().trim().max(80).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.imageUrls.length && !v.images.length) {
      ctx.addIssue({ code: "custom", message: "Add a product image (upload or URL) before generating.", path: ["imageUrls"] });
    }
  });

export type GenerateProductInput = z.infer<typeof generateProductInputSchema>;

export const generatedProductSchema = z.object({
  title: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  categorySuggestions: z.array(z.string()),
  tags: z.array(z.string()),
  attributes: z.object({
    fabric: z.string(),
    style: z.string(),
    length: z.string(),
    work: z.string(),
    pattern: z.string(),
    occasion: z.array(z.string()),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  seoTitle: z.string(),
  seoDescription: z.string(),
  brand: z.string(),
  careInstructions: z.string(),
  productTypeHint: z.string(),
  /** Integer paise when the model offers a price guess; null otherwise. */
  priceHintPaise: z.number().int().nullable(),
});

export type GeneratedProduct = z.infer<typeof generatedProductSchema>;

export const generateProductEdgeResponseSchema = z.object({
  ok: z.literal(true),
  product: generatedProductSchema,
  meta: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
});
