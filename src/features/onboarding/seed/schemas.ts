import { z } from "zod";
import { slug } from "@/lib/validation/common";
import { isIndustry } from "@/features/stores/industries";

/** Input accepted by the seed pipeline / server action (after create_tenant). */
export const seedReadyStoreInputSchema = z.object({
  tenantId: z.uuid(),
  storeName: z.string().trim().min(2).max(120),
  industry: z.string().refine(isIndustry, "Choose a valid store category"),
  /** Free-text brief from voice / onboarding (optional). */
  brief: z.string().trim().max(4000).optional(),
  /** BCP-47 / Sarvam language code for optional translation of generated copy. */
  locale: z.string().trim().min(2).max(16).optional(),
  /** Apply best-fit marketplace theme before content merge (default true). */
  applyTheme: z.boolean().default(true),
  /** Override auto-picked marketplace theme key. */
  themeKey: z.string().trim().min(2).max(80).optional(),
  /** Skip AI and persist this plan (tests / callers that already generated). */
  plan: z.unknown().optional(),
});

export type SeedReadyStoreInput = z.infer<typeof seedReadyStoreInputSchema>;

const categoryPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().trim().max(5000).default(""),
});

const productPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  categorySlug: slug,
  shortDescription: z.string().trim().max(500).default(""),
  description: z.string().trim().max(20_000).default(""),
  /** Integer paise (src/lib/money.ts). */
  pricePaise: z.number().int().positive().max(100_000_000),
  compareAtPaise: z.number().int().positive().max(100_000_000).nullable().optional(),
  featured: z.boolean().default(false),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(20).default([]),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  hsnCode: z
    .string()
    .trim()
    .regex(/^[0-9]{4,8}$/)
    .optional(),
  weightGrams: z.number().int().min(0).max(100_000).default(500),
});

const heroSlideSchema = z.object({
  eyebrow: z.string().trim().max(60).default(""),
  heading: z.string().trim().min(1).max(120),
  subheading: z.string().trim().max(280).default(""),
  ctaLabel: z.string().trim().max(40).default("Shop now"),
  /** Path starting with / (e.g. /categories/kurtas). */
  ctaHref: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[^\s]*$/, "Use a path starting with /")
    .default("/collections"),
});

const collectionTileSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug,
  description: z.string().trim().max(5000).default(""),
});

const blogPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  excerpt: z.string().trim().max(500).default(""),
  paragraphs: z.array(z.string().trim().min(1).max(5000)).min(1).max(12),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(10).default([]),
});

const testimonialSchema = z.object({
  quote: z.string().trim().min(1).max(400),
  author: z.string().trim().min(1).max(60),
  location: z.string().trim().max(60).default(""),
  rating: z.number().int().min(1).max(5).default(5),
});

/** Structured JSON produced by Sarvam chat (Zod-validated before persist). */
export const readyStorePlanSchema = z.object({
  tagline: z.string().trim().min(1).max(160),
  story: z.string().trim().min(1).max(2000),
  seo: z.object({
    title: z.string().trim().min(1).max(70),
    description: z.string().trim().min(1).max(160),
  }),
  categories: z.array(categoryPlanSchema).length(4),
  products: z.array(productPlanSchema).length(8),
  collections: z.array(collectionTileSchema).min(2).max(4),
  hero: z.object({
    slides: z.array(heroSlideSchema).min(1).max(3),
  }),
  blogs: z.array(blogPlanSchema).length(3),
  testimonials: z.array(testimonialSchema).length(4),
});

export type ReadyStorePlan = z.infer<typeof readyStorePlanSchema>;

export type SeedReadyStoreResult = {
  themeKey: string | null;
  categoryIds: string[];
  productIds: string[];
  collectionIds: string[];
  blogIds: string[];
  menuId: string | null;
  skipped: {
    categories: number;
    products: number;
    collections: number;
    blogs: number;
    menu: boolean;
  };
  alreadySeeded: boolean;
};
