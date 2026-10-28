import { z } from "zod";
import { contentBlockSchema } from "@/features/content/blocks";
import { AI_PROVIDERS } from "@/features/neural-pulse/schemas";
import { slugify } from "@/features/catalog/variants";

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
  provider: z.enum(AI_PROVIDERS),
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

export const SELLER_AI_CREDIT_KINDS = ["generate_product", "generate_blog", "contact_reply", "business_coach", "store_agent", "store_setup"] as const;
export type SellerAiCreditKind = (typeof SELLER_AI_CREDIT_KINDS)[number];

export const SELLER_AI_KIND_LABELS: Record<SellerAiCreditKind, string> = {
  generate_product: "Product from image",
  generate_blog: "Blog AI Write",
  contact_reply: "Contact reply draft",
  business_coach: "Business coach",
  store_agent: "Store assistant chat",
  store_setup: "Store setup from a prompt",
};

// ---- Store agent chat ------------------------------------------------------------------------

/**
 * Dashboard pages the store agent may link to. The model only returns a key; the href comes from
 * this table, so a reply can never point outside the seller dashboard.
 */
export const AGENT_LINKS = {
  home: "/dashboard",
  products: "/dashboard/products",
  new_product: "/dashboard/products/new",
  categories: "/dashboard/categories",
  collections: "/dashboard/collections",
  inventory: "/dashboard/inventory",
  low_stock: "/dashboard/inventory?stock=low",
  orders: "/dashboard/orders",
  unfulfilled_orders: "/dashboard/orders?fulfillment=unfulfilled",
  customers: "/dashboard/customers",
  discounts: "/dashboard/discounts",
  analytics: "/dashboard/analytics",
  reviews: "/dashboard/reviews",
  blog: "/dashboard/content/blog",
  theme: "/dashboard/theme",
  themes: "/dashboard/themes",
  ai_marketing: "/dashboard/marketing/neural-pulse",
  payments: "/dashboard/settings/payments",
  shipping: "/dashboard/settings/shipping",
  domains: "/dashboard/settings/domains",
  seo: "/dashboard/settings/seo",
  plan: "/dashboard/settings/plan",
  store_settings: "/dashboard/settings",
} as const;
export type AgentLinkKey = keyof typeof AGENT_LINKS;
export const AGENT_LINK_KEYS = Object.keys(AGENT_LINKS) as AgentLinkKey[];

export const AGENT_MAX_TURNS = 8;

export const agentChatInputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(AGENT_MAX_TURNS * 2)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be the seller's question"),
});
export type AgentChatInput = z.infer<typeof agentChatInputSchema>;

/** Model reply: unknown link keys are dropped (never fail the whole answer for a bad link). */
export const agentReplyContentSchema = z.object({
  answer: z.string().trim().min(1).max(3000),
  links: z
    .array(z.object({ key: z.string(), label: z.string().trim().min(1).max(60) }))
    .max(6)
    .catch([])
    .default([])
    .transform((links) => {
      const seen = new Set<string>();
      const out: { key: AgentLinkKey; label: string; href: string }[] = [];
      for (const l of links) {
        if (!(l.key in AGENT_LINKS) || seen.has(l.key)) continue;
        seen.add(l.key);
        out.push({ key: l.key as AgentLinkKey, label: l.label, href: AGENT_LINKS[l.key as AgentLinkKey] });
      }
      return out.slice(0, 4);
    }),
});
export const agentReplyResultSchema = agentReplyContentSchema.merge(generationMetaSchema);
export type AgentReplyResult = z.infer<typeof agentReplyResultSchema>;

// ---- Store setup from a prompt ---------------------------------------------------------------

export const STORE_SETUP_MAX_PRODUCTS = 8;

export const storeSetupInputSchema = z.object({
  prompt: z.string().trim().min(10, "Describe your shop in a sentence or two").max(1000),
  products: z.array(z.string().trim().max(120)).max(STORE_SETUP_MAX_PRODUCTS).default([]),
  applyTheme: z.boolean().default(false),
});

const setupSlug = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80))
  .pipe(z.string().min(1));

export const storeSetupContentSchema = z.object({
  industry: z.string().trim().max(40).nullable().catch(null).default(null),
  categories: z
    .array(z.object({ name: z.string().trim().min(1).max(80), slug: setupSlug, description: z.string().trim().max(500).catch("").default("") }))
    .min(1)
    .max(6),
  products: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        categorySlug: setupSlug,
        shortDescription: z.string().trim().max(280).catch("").default(""),
        description: z.string().trim().max(4000).catch("").default(""),
        priceMinor: z.number().int().min(100).max(100_000_000),
        tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(8).catch([]).default([]),
        seoTitle: z.string().trim().max(70).catch("").default(""),
        seoDescription: z.string().trim().max(160).catch("").default(""),
      }),
    )
    .min(1)
    .max(STORE_SETUP_MAX_PRODUCTS),
});
export type StoreSetupContent = z.infer<typeof storeSetupContentSchema>;
export type StoreSetupResult = { categories: number; products: number; themeKey: string | null; skipped: number };

/** Next free slug: `kurta`, `kurta-2`, `kurta-3`… (adds the result to `taken`). */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base, 100) || "item";
  let candidate = root;
  for (let n = 2; taken.has(candidate); n++) candidate = `${root}-${n}`;
  taken.add(candidate);
  return candidate;
}
