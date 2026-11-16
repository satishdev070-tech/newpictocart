import { productInputSchema, type ProductInput } from "@/features/catalog/schemas";
import { toDecimalString } from "@/lib/money";
import type { ReadyStorePlan } from "./schemas";
import { withSamplePrefix } from "./sample-title";

type PlanProduct = ReadyStorePlan["products"][number];

const TITLE_MAX = 200;
const SEO_TITLE_MAX = 120;
const SEO_DESCRIPTION_MAX = 320;
/** Characters the catalog tag schema rejects (they break Postgres array / filter syntax). */
const TAG_BLOCKED = /[{}",\\()]/g;

function clip(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/**
 * Slug-derived SKU: unique per tenant because product slugs are, so a retried or concurrent
 * finalize with a different plan never collides on a positional `SEED-01`.
 */
export function seedSku(slug: string, index: number): string {
  const base = slug.replace(/[^a-z0-9-]/gi, "").toUpperCase().slice(0, 56);
  return base ? `SEED-${base}` : `SEED-${String(index + 1).padStart(2, "0")}`;
}

/** Same rules as the catalog `tagSchema`, applied up front so one odd AI tag can't fail the seed. */
export function sanitizeSeedTags(tags: readonly string[], fallback: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(TAG_BLOCKED, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40).trim();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= 20) break;
  }
  return out.length ? out : fallback;
}

/**
 * The catalog input for one seeded product. The ready-store plan schema is looser than the
 * catalog schema (titles, tags, SEO fields, MRP), so every field is normalised here to what
 * `productInputSchema` accepts before `save_product` runs. Pure: no DB, safe to unit test.
 */
export function buildSeedProductInput(args: {
  product: PlanProduct;
  index: number;
  storeName: string;
  productType: string;
  categoryId: string | null;
}): unknown {
  const { product: p, index: i, storeName } = args;
  const title = clip(withSamplePrefix(p.title), TITLE_MAX);
  const description = clip(p.description || p.shortDescription, 20_000) || null;
  const shortDescription = clip(p.shortDescription, 500) || null;
  // MRP below price fails the variant rule; drop it rather than fail the whole store.
  const compareAt = p.compareAtPaise != null && p.compareAtPaise > p.pricePaise ? p.compareAtPaise : null;
  return {
    title,
    slug: p.slug,
    description,
    shortDescription,
    productType: args.productType,
    brand: clip(storeName, 120) || null,
    categoryId: args.categoryId,
    status: "active",
    // Active products require countryOfOrigin (catalog schema); seed defaults to India.
    countryOfOrigin: "India",
    featured: p.featured || i < 2,
    tags: sanitizeSeedTags(p.tags, i === 0 ? ["bestseller"] : []),
    attributes: { occasion: [], specs: [] },
    careInstructions: null,
    shippingInfo: null,
    returnInfo: null,
    hsnCode: p.hsnCode ?? null,
    seoTitle: clip(p.seoTitle || `${title} | ${storeName}`, SEO_TITLE_MAX),
    seoDescription: clip(p.seoDescription || p.shortDescription || p.description || title, SEO_DESCRIPTION_MAX),
    options: [],
    variants: [
      {
        option1: null,
        option2: null,
        option3: null,
        sku: seedSku(p.slug, i),
        price: toDecimalString(p.pricePaise),
        compareAtPrice: compareAt != null ? toDecimalString(compareAt) : "",
        weightGrams: String(p.weightGrams),
        trackInventory: true,
        lowStockThreshold: "3",
        initialStock: "10",
        status: "active",
      },
    ],
  };
}

/** Parse result for one seeded product; `issues` lists the failing paths (for logs and tests). */
export function parseSeedProduct(args: Parameters<typeof buildSeedProductInput>[0]):
  | { ok: true; input: ProductInput }
  | { ok: false; issues: { path: string; message: string }[] } {
  const r = productInputSchema.safeParse(buildSeedProductInput(args));
  if (r.success) return { ok: true, input: r.data };
  return { ok: false, issues: r.error.issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message })) };
}
