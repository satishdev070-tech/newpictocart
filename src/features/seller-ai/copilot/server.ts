import "server-only";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import { assertPermission, can, type TenantContext } from "@/lib/tenant/membership";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { getDashboardHome } from "@/features/analytics/home";
import { getAiCreditBalance, getAiCreditCatalog } from "@/features/ai-credits/server";
import { listCategoryFilterOptions } from "@/features/catalog/server/categories";
import { productListQuerySchema } from "@/features/catalog/schemas";
import { listProducts } from "@/features/catalog/server/products";
import { AGENT_PRODUCT_SNAPSHOT_LIMIT } from "../schemas";
import { buildStoreSnapshot } from "../snapshot";
import type { CatalogueRef, ProductCopy } from "./proposals";
import type { StoreApplyPayload } from "./schemas";

/**
 * Online-store copilot server helpers. `ctx` is always the member's own membership
 * (requireTenant); reads use the member's session so RLS scopes them to this store and role.
 */

const FAQ_APPLY_FALLBACK = 5;
const ASK_FALLBACK = 1;

export type CopilotCostCtx = { ask: number; faqApply: number };

/** Credits per question (store_agent) and per FAQ apply (generate_faq), from Super Admin config. */
export async function storeCopilotCosts(): Promise<CopilotCostCtx> {
  const catalog = await getAiCreditCatalog().catch(() => null);
  const cost = (kind: string, fallback: number) => catalog?.costs.find((c) => c.kind === kind)?.credits ?? fallback;
  return { ask: cost("store_agent", ASK_FALLBACK), faqApply: cost("generate_faq", FAQ_APPLY_FALLBACK) };
}

async function storeIndustry(tenantId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("stores").select("store_categories(slug)").eq("tenant_id", tenantId).maybeSingle();
  if (error) return null;
  const cat = data?.store_categories as { slug: string } | { slug: string }[] | null | undefined;
  return (Array.isArray(cat) ? cat[0]?.slug : cat?.slug) ?? null;
}

async function planBrief(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tenants").select("status, trial_ends_at, plans(name)").eq("id", tenantId).maybeSingle();
  if (error || !data) return { planName: null, status: null, trialEndsAt: null };
  const plan = data.plans as { name: string } | { name: string }[] | null;
  return { planName: Array.isArray(plan) ? (plan[0]?.name ?? null) : (plan?.name ?? null), status: data.status, trialEndsAt: data.trial_ends_at };
}

/** Compact store snapshot for the copilot + the catalogue refs used to resolve product proposals. */
export async function loadStoreCopilotContext(ctx: TenantContext): Promise<{ snapshot: string; products: CatalogueRef[] }> {
  const catalog = can(ctx, "catalog.read");
  const [home, balance, products, categories, plan, industry] = await Promise.all([
    getDashboardHome(ctx),
    getAiCreditBalance(ctx.tenantId).catch(() => null),
    catalog
      ? listProducts(ctx.tenantId, productListQuerySchema.parse({}), AGENT_PRODUCT_SNAPSHOT_LIMIT)
          .then((r) => r.rows)
          .catch((err: unknown) => {
            logger.warn("seller_ai.copilot_products_unavailable", { message: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
            return [];
          })
      : Promise.resolve([]),
    catalog
      ? listCategoryFilterOptions(ctx.tenantId)
          .then((rows) => rows.map((c) => c.name).filter(Boolean).slice(0, 40))
          .catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    can(ctx, "store.read") ? planBrief(ctx.tenantId) : Promise.resolve({ planName: null, status: null, trialEndsAt: null }),
    storeIndustry(ctx.tenantId),
  ]);
  const snapshot = buildStoreSnapshot({
    storeName: ctx.tenantName,
    storeStatus: ctx.tenantStatus,
    storeUrl: storeOrigin(storeSubdomain(ctx.tenantSlug)),
    home,
    products: products.map((p) => ({ title: p.title, status: p.status, minPrice: p.minPrice, stockTotal: p.stockTotal, categoryName: p.categoryName })),
    creditBalance: balance,
    categories,
    plan,
    industry,
  });
  return { snapshot, products: products.map((p) => ({ id: p.id, title: p.title })) };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Current copy of the given products in this store (the "before" side of the diff). */
export async function loadProductCopy(tenantId: string, ids: string[]): Promise<Map<string, ProductCopy>> {
  const out = new Map<string, ProductCopy>();
  if (!ids.length) return out;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("products").select("id, description, short_description, seo").eq("tenant_id", tenantId).in("id", ids.slice(0, 8));
  if (error) {
    logger.warn("seller_ai.copilot_product_copy_unavailable", { code: error.code });
    return out;
  }
  for (const p of data ?? []) {
    const seo = obj(p.seo);
    out.set(p.id, { description: str(p.description), shortDescription: str(p.short_description), seoTitle: str(seo.title), seoDescription: str(seo.description) });
  }
  return out;
}

/**
 * Applies an approved product-copy proposal. Guards: catalog.write, and the product must belong
 * to the member's store (tenant from membership + RLS); the id from the client is never trusted
 * on its own.
 */
export async function applyProductCopy(ctx: Pick<TenantContext, "tenantId" | "permissions" | "user">, p: Extract<StoreApplyPayload, { type: "product_copy" }>): Promise<{ message: string }> {
  assertPermission(ctx, "catalog.write");
  const supabase = await createSupabaseServerClient();
  const { data: product, error } = await supabase.from("products").select("id, title, seo").eq("tenant_id", ctx.tenantId).eq("id", p.productId).maybeSingle();
  if (error) throw mapDbError(error);
  if (!product) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["That product isn't in your store any more."] } });
  const patch: { description?: string; short_description?: string; seo?: Json } = {};
  if (p.description) patch.description = p.description;
  if (p.shortDescription) patch.short_description = p.shortDescription;
  if (p.seoTitle || p.seoDescription) {
    const seo = { ...obj(product.seo) };
    if (p.seoTitle) seo.title = p.seoTitle;
    if (p.seoDescription) seo.description = p.seoDescription;
    patch.seo = seo as Json;
  }
  const { data: updated, error: updateError } = await supabase.from("products").update(patch).eq("tenant_id", ctx.tenantId).eq("id", p.productId).select("id");
  if (updateError) throw mapDbError(updateError);
  if (!updated?.length) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["That product isn't in your store any more."] } });
  await audit({ tenantId: ctx.tenantId, actorUserId: ctx.user.id, action: "product.ai_copy_applied", entityType: "product", entityId: p.productId, metadata: { fields: Object.keys(patch) } });
  return { message: `Updated "${product.title}".` };
}
