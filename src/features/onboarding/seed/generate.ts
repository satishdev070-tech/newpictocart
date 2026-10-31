import "server-only";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { isSarvamConfigured } from "@/lib/sarvam/client";
import { industryName, type IndustrySlug } from "@/features/stores/industries";
import { chatTurn, translateText } from "./sarvam";
import { READY_STORE_COUNTS } from "./counts";
import { buildFallbackReadyStorePlan } from "./fallback";
import { readyStorePlanSchema, type ReadyStorePlan } from "./schemas";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new AppError("INTERNAL", { fieldErrors: { _form: ["The AI didn't return valid store data. Please try again."] }, context: { reason: "seed_json_parse" } });
}

function buildPrompt(args: {
  storeName: string;
  industry: IndustrySlug;
  subcategory?: string | null;
  niche?: string | null;
  brief?: string;
}): { system: string; user: string } {
  const industry = industryName(args.industry);
  const { categories, products, blogs, testimonials } = READY_STORE_COUNTS;
  const nicheHint = [args.subcategory?.trim(), args.niche?.trim()].filter(Boolean).join(" / ");
  const system = [
    "You are a catalogue writer for Indian D2C storefronts on Pictocart.",
    "Reply with a single JSON object only (no markdown). Prices must be integer paise (₹1 = 100).",
    "Use lowercase hyphenated slugs. Keep copy warm, concrete and India-relevant.",
    `Exactly ${categories} categories, exactly ${products} products (each categorySlug must match a category), 2–4 collections,`,
    `1–3 hero slides, ${blogs} blog posts, ${testimonials} testimonials.`,
    "Product titles and categories MUST match the seller's niche/subcategory — never invent unrelated SKUs",
    "(e.g. no ethnic juttis for activewear; bags stores get bags/wallets only).",
    `Return exactly ${products} niche-aligned sample products (titles need not include the word Sample).`,
  ].join(" ");
  const user = [
    `Store name: ${args.storeName}`,
    `Industry: ${args.industry} (${industry})`,
    nicheHint ? `Niche / subcategory: ${nicheHint}` : "Niche / subcategory: (none — stay within the industry)",
    args.brief ? `Seller brief: ${args.brief}` : "Seller brief: (none — invent a plausible brand story)",
    "",
    "JSON shape:",
    JSON.stringify({
      tagline: "string",
      story: "string",
      seo: { title: "≤70 chars", description: "≤160 chars" },
      categories: [{ name: "", slug: "", description: "" }],
      products: [
        {
          title: "",
          slug: "",
          categorySlug: "",
          shortDescription: "",
          description: "",
          pricePaise: 149900,
          compareAtPaise: 199900,
          featured: true,
          tags: ["bestseller"],
          seoTitle: "",
          seoDescription: "",
          hsnCode: "6109",
          weightGrams: 400,
        },
      ],
      collections: [{ title: "Bestsellers", slug: "bestsellers", description: "" }],
      hero: { slides: [{ eyebrow: "", heading: "", subheading: "", ctaLabel: "Shop now", ctaHref: "/categories/example" }] },
      blogs: [{ title: "", slug: "", excerpt: "", paragraphs: ["..."], seoTitle: "", seoDescription: "", tags: [] }],
      testimonials: [{ quote: "", author: "", location: "Bengaluru", rating: 5 }],
    }),
  ].join("\n");
  return { system, user };
}

/** Optionally translate selected marketing strings when locale is not English. */
async function maybeLocalize(plan: ReadyStorePlan, locale?: string): Promise<ReadyStorePlan> {
  if (!locale) return plan;
  const code = locale.trim().replace("_", "-");
  if (code === "en" || code === "en-IN" || code.toLowerCase().startsWith("en")) return plan;
  const translate = async (text: string) => {
    if (!text.trim()) return text;
    try {
      const r = await translateText({ text, targetLanguageCode: code, sourceLanguageCode: "en-IN" });
      return r.translatedText?.trim() || text;
    } catch {
      return text;
    }
  };
  return {
    ...plan,
    tagline: await translate(plan.tagline),
    story: await translate(plan.story),
    seo: { title: await translate(plan.seo.title), description: await translate(plan.seo.description) },
    hero: {
      slides: await Promise.all(
        plan.hero.slides.map(async (s) => ({
          ...s,
          eyebrow: await translate(s.eyebrow),
          heading: await translate(s.heading),
          subheading: await translate(s.subheading),
          ctaLabel: await translate(s.ctaLabel),
        })),
      ),
    },
    testimonials: await Promise.all(
      plan.testimonials.map(async (t) => ({
        ...t,
        quote: await translate(t.quote),
      })),
    ),
  };
}

function validateAiPlan(raw: unknown): ReadyStorePlan {
  const parsed = readyStorePlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["The AI store plan failed validation. Please try again."] },
      context: { reason: "seed_plan_invalid", issues: parsed.error.issues.slice(0, 5).map((i) => i.message) },
    });
  }
  const catSlugs = new Set(parsed.data.categories.map((c) => c.slug));
  for (const p of parsed.data.products) {
    if (!catSlugs.has(p.categorySlug)) {
      throw new AppError("VALIDATION", {
        fieldErrors: { _form: [`Product "${p.title}" references unknown category "${p.categorySlug}".`] },
        context: { reason: "seed_category_mismatch" },
      });
    }
  }
  for (const p of parsed.data.products) {
    if (p.compareAtPaise != null && p.compareAtPaise < p.pricePaise) {
      throw new AppError("VALIDATION", {
        fieldErrors: { _form: [`Product "${p.title}" has MRP below price.`] },
        context: { reason: "seed_price_mrp" },
      });
    }
  }
  return parsed.data;
}

async function fallbackPlan(args: {
  storeName: string;
  industry: IndustrySlug;
  subcategory?: string | null;
  niche?: string | null;
  brief?: string;
  locale?: string;
  reason: string;
}): Promise<ReadyStorePlan> {
  logger.warn("onboarding.seed_plan_fallback", { industry: args.industry, reason: args.reason });
  const plan = buildFallbackReadyStorePlan({
    storeName: args.storeName,
    industry: args.industry,
    subcategory: args.subcategory,
    niche: args.niche,
    brief: args.brief,
  });
  return maybeLocalize(plan, args.locale);
}

/**
 * Ask Sarvam chat for a structured ready-store plan and Zod-validate it.
 * Falls back to a deterministic plan when Sarvam is missing or the response is invalid.
 * Callers should debit AI credits around this (see pipeline).
 */
export async function generateReadyStorePlan(args: {
  storeName: string;
  industry: IndustrySlug;
  subcategory?: string | null;
  niche?: string | null;
  brief?: string;
  locale?: string;
}): Promise<ReadyStorePlan> {
  if (!isSarvamConfigured()) {
    return fallbackPlan({ ...args, reason: "sarvam_not_configured" });
  }

  try {
    const { system, user } = buildPrompt(args);
    const turn = await chatTurn({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      languageCode: args.locale ?? "en-IN",
      temperature: 0.4,
    });
    const raw = extractJson(turn.content);
    const plan = validateAiPlan(raw);
    return maybeLocalize(plan, args.locale);
  } catch (err) {
    const reason =
      err instanceof AppError
        ? String((err.context as { reason?: string } | undefined)?.reason ?? err.code)
        : err instanceof Error
          ? err.message.slice(0, 120)
          : "unknown";
    return fallbackPlan({ ...args, reason });
  }
}

export function parseReadyStorePlan(raw: unknown): ReadyStorePlan {
  return readyStorePlanSchema.parse(raw);
}
