import "server-only";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/observability/logger";
import { toDecimalString } from "@/lib/money";
import { mapDbError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidateStorefront } from "@/lib/cache/storefront";
import { can, type TenantContext } from "@/lib/tenant/membership";
import { productInputSchema, toSaveProductPayload } from "@/features/catalog/schemas";
import { assertProductCapacity, callSaveProduct } from "@/features/catalog/server/products";
import { saveCategory } from "@/features/catalog/server/categories";
import { addProductImage } from "@/features/catalog/server/media";
import { defaultTypeForIndustry } from "@/features/catalog/product-types";
import { applyBestFitTheme } from "@/features/onboarding/seed/theme-pick";
import { isIndustry } from "@/features/stores/industries";
import { uniqueSlug, type StoreSetupContent, type StoreSetupResult } from "./schemas";

/**
 * Writes an AI store plan into THIS store (tenant from the membership context, RLS session).
 * Categories are reused by name/slug; products are created as drafts so the seller reviews prices
 * and stock before they go live. The matching marketplace theme is applied to the theme DRAFT only.
 */
export async function persistStoreSetup(
  ctx: TenantContext,
  plan: StoreSetupContent,
  opts: { industry: string | null; applyTheme: boolean; images: (File | null)[] },
): Promise<StoreSetupResult> {
  const supabase = await createSupabaseServerClient();
  const [{ data: cats, error: cErr }, { data: prods, error: pErr }] = await Promise.all([
    supabase.from("categories").select("id, slug, name").eq("tenant_id", ctx.tenantId),
    supabase.from("products").select("slug").eq("tenant_id", ctx.tenantId),
  ]);
  if (cErr) throw mapDbError(cErr);
  if (pErr) throw mapDbError(pErr);
  await assertProductCapacity(ctx.tenantId, plan.products.length);

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
  let createdProducts = 0;
  let skipped = 0;
  for (const [i, p] of plan.products.entries()) {
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

  let themeKey: string | null = null;
  if (opts.applyTheme && opts.industry && isIndustry(opts.industry) && can(ctx, "theme.edit")) {
    try {
      themeKey = (await applyBestFitTheme(ctx, opts.industry)).key;
    } catch (err) {
      logger.warn("seller_ai.setup_theme_skipped", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
    }
  }

  await audit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.user.id,
    action: "ai.store_setup_applied",
    entityType: "tenant",
    entityId: ctx.tenantId,
    metadata: { categories: createdCategories, products: createdProducts, skipped, themeKey },
  });
  revalidateStorefront(ctx.tenantId);
  return { categories: createdCategories, products: createdProducts, themeKey, skipped };
}
