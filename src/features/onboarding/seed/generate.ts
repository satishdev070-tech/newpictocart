import "server-only";
import { AppError } from "@/lib/errors";
import { industryName, type IndustrySlug } from "@/features/stores/industries";
import { chatTurn, translateText } from "./sarvam";
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

function buildPrompt(args: { storeName: string; industry: IndustrySlug; brief?: string }): { system: string; user: string } {
  const industry = industryName(args.industry);
  const system = [
    "You are a catalogue writer for Indian D2C storefronts on Pictocart.",
    "Reply with a single JSON object only (no markdown). Prices must be integer paise (₹1 = 100).",
    "Use lowercase hyphenated slugs. Keep copy warm, concrete and India-relevant.",
    "Exactly 4 categories, 8 products (each categorySlug must match a category), 2–4 collections,",
    "1–3 hero slides, 3 blog posts, 4 testimonials.",
  ].join(" ");
  const user = [
    `Store name: ${args.storeName}`,
    `Industry: ${args.industry} (${industry})`,
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

/**
 * Ask Sarvam chat for a structured ready-store plan and Zod-validate it.
 * Callers should debit AI credits around this (see pipeline).
 */
export async function generateReadyStorePlan(args: {
  storeName: string;
  industry: IndustrySlug;
  brief?: string;
  locale?: string;
}): Promise<ReadyStorePlan> {
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
  const parsed = readyStorePlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", {
      fieldErrors: { _form: ["The AI store plan failed validation. Please try again."] },
      context: { reason: "seed_plan_invalid", issues: parsed.error.issues.slice(0, 5).map((i) => i.message) },
    });
  }
  // Every product must reference a known category slug.
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
  return maybeLocalize(parsed.data, args.locale);
}

export function parseReadyStorePlan(raw: unknown): ReadyStorePlan {
  return readyStorePlanSchema.parse(raw);
}
