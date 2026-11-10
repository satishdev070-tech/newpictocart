import "server-only";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/observability/logger";
import { toDecimalString } from "@/lib/money";
import { mapDbError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { can, type TenantContext } from "@/lib/tenant/membership";
import type { Json } from "@/lib/supabase/database.types";
import { productInputSchema, toSaveProductPayload } from "@/features/catalog/schemas";
import { assertProductCapacity, callSaveProduct, countProducts, productLimit } from "@/features/catalog/server/products";
import { saveCategory } from "@/features/catalog/server/categories";
import { addProductImage } from "@/features/catalog/server/media";
import { defaultTypeForIndustry } from "@/features/catalog/product-types";
import { uniqueSlug, type StoreSetupContent, type StoreSetupResult } from "./schemas";

/**
 * Writes an AI store plan into THIS store (tenant from the membership context, RLS session).
 * Categories are reused by name/slug; products and blogs are drafts; reviews land as pending
 * sample rows for moderation. Product count respects the plan limit (extras are dropped).
 */
export async function persistStoreSetup(
  ctx: TenantContext,
  plan: StoreSetupContent,
  opts: { industry: string | null; images: (File | null)[] },
): Promise<StoreSetupResult> {
  const supabase = await createSupabaseServerClient();
  const [{ data: cats, error: cErr }, { data: prods, error: pErr }, { data: blogsExisting, error: bErr }] = await Promise.all([
    supabase.from("categories").select("id, slug, name").eq("tenant_id", ctx.tenantId),
    supabase.from("products").select("slug").eq("tenant_id", ctx.tenantId),
    supabase.from("blog_posts").select("slug").eq("tenant_id", ctx.tenantId),
  ]);
  if (cErr) throw mapDbError(cErr);
  if (pErr) throw mapDbError(pErr);
  if (bErr) throw mapDbError(bErr);

  const limit = await productLimit(ctx.tenantId);
  const currentCount = await countProducts(ctx.tenantId);
  const room = limit === null ? plan.products.length : Math.max(0, limit - currentCount);
  if (room === 0) await assertProductCapacity(ctx.tenantId, plan.products.length);
  const productsToCreate = plan.products.slice(0, room);
  await assertProductCapacity(ctx.tenantId, productsToCreate.length);

  const catSlugs = new Set((cats ?? []).map((c) => c.slug));
  const byKey = new Map<string, string>();
  for (const c of cats ?? []) {
    byKey.set(c.slug, c.id);
    byKey.set(c.name.trim().toLowerCase(), c.id);
  }
  let createdCategories = 0;
  for (const [i, c] of plan.categories.entries()) {
    const existing = byKey.get(c.slug) ?? byKey.get(c.name.trim().toLowerCase());
    if (existing) {
      byKey.set(c.slug, existing);
      continue;
    }
    const slug = uniqueSlug(c.slug, catSlugs);
    const r = await saveCategory(
      ctx.tenantId,
      { id: null, name: c.name, slug, description: c.description || null, parentId: null, sizeChartId: null, status: "active", position: (cats?.length ?? 0) + i + 1, seoTitle: null, seoDescription: null, removeImage: false },
      undefined,
    );
    byKey.set(c.slug, r.id);
    createdCategories += 1;
  }

  const productSlugs = new Set((prods ?? []).map((p) => p.slug));
  const productType = defaultTypeForIndustry(opts.industry);
  const createdProductIds: { id: string; title: string }[] = [];
  let createdProducts = 0;
  let skipped = 0;
  for (const [i, p] of productsToCreate.entries()) {
    try {
      const input = productInputSchema.parse({
        title: p.title,
        slug: uniqueSlug(p.title, productSlugs),
        description: p.description || p.shortDescription,
        shortDescription: p.shortDescription,
        productType,
        brand: ctx.tenantName,
        categoryId: byKey.get(p.categorySlug) ?? null,
        status: "draft",
        featured: false,
        tags: p.tags,
        attributes: { occasion: [], specs: [] },
        careInstructions: null,
        shippingInfo: null,
        returnInfo: null,
        hsnCode: null,
        seoTitle: p.seoTitle || `${p.title} | ${ctx.tenantName}`.slice(0, 120),
        seoDescription: p.seoDescription || (p.shortDescription || p.description).slice(0, 320),
        options: [],
        variants: [{ option1: null, option2: null, option3: null, sku: "", price: toDecimalString(p.priceMinor), compareAtPrice: "", weightGrams: "500", trackInventory: true, lowStockThreshold: "3", initialStock: "0", status: "active" }],
      });
      const { data: id, error } = await callSaveProduct(supabase, ctx.tenantId, toSaveProductPayload(input, { allowInitialStock: true }));
      if (error || !id) throw error ? mapDbError(error) : new AppError("INTERNAL");
      createdProducts += 1;
      createdProductIds.push({ id, title: p.title });
      const file = opts.images[i];
      if (file) {
        try {
          await addProductImage(ctx.tenantId, id, file, p.title.slice(0, 200));
        } catch (err) {
          logger.warn("seller_ai.setup_image_failed", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
        }
      }
    } catch (err) {
      skipped += 1;
      logger.warn("seller_ai.setup_product_failed", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
    }
  }

  let createdBlogs = 0;
  if (can(ctx, "content.write") && plan.blogs.length) {
    const blogSlugs = new Set((blogsExisting ?? []).map((b) => b.slug));
    for (const b of plan.blogs) {
      try {
        const slug = uniqueSlug(b.slug || b.title, blogSlugs);
        const body = b.paragraphs.map((text) => ({ type: "paragraph" as const, text }));
        const { error } = await supabase.from("blog_posts").insert({
          tenant_id: ctx.tenantId,
          title: b.title,
          slug,
          status: "draft",
          body: body as unknown as Json,
          excerpt: b.excerpt || b.paragraphs[0]!.slice(0, 280),
          author_name: null,
          tags: b.tags,
          seo: { title: b.seoTitle || b.title, description: b.seoDescription || b.excerpt },
          published_at: null,
          created_by: ctx.user.id,
        });
        if (error) throw mapDbError(error);
        createdBlogs += 1;
      } catch (err) {
        skipped += 1;
        logger.warn("seller_ai.setup_blog_failed", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
      }
    }
  }

  let createdReviews = 0;
  if (createdProductIds.length && plan.reviews.length) {
    // Staff have no INSERT policy on reviews (customers + secret key only). Sample pending
    // rows use the admin client — same pattern as storefront submit and demo seed.
    const byTitle = new Map(createdProductIds.map((p) => [p.title.trim().toLowerCase(), p.id]));
    const rows = plan.reviews.map((r, i) => {
      const key = r.productTitle.trim().toLowerCase();
      const productId =
        byTitle.get(key) ??
        createdProductIds.find((p) => p.title.toLowerCase().includes(key.slice(0, 24)))?.id ??
        createdProductIds[i % createdProductIds.length]!.id;
      return {
        tenant_id: ctx.tenantId,
        product_id: productId,
        rating: r.rating,
        title: r.title || null,
        body: r.body,
        author_name: r.authorName.slice(0, 80),
        status: "pending",
        verified_purchase: false,
        source: "sample",
      };
    });
    try {
      const { data, error } = await createSupabaseAdminClient().from("reviews").insert(rows).select("id");
      if (error) throw mapDbError(error);
      createdReviews = data?.length ?? rows.length;
    } catch (err) {
      skipped += 1;
      logger.warn("seller_ai.setup_reviews_failed", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
    }
  }

  await audit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.user.id,
    action: "ai.store_setup_applied",
    entityType: "tenant",
    entityId: ctx.tenantId,
    metadata: { categories: createdCategories, products: createdProducts, blogs: createdBlogs, reviews: createdReviews, skipped },
  });
  revalidateStorefront(ctx.tenantId);
  return { categories: createdCategories, products: createdProducts, blogs: createdBlogs, reviews: createdReviews, skipped };
}
