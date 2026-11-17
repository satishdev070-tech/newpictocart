import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/audit";
import { assertPermission, type TenantContext } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import type { IndustrySlug } from "@/features/stores/industries";
import { generateReadyStorePlan } from "./generate";
import {
  ensureBlogs,
  ensureCategories,
  ensureCollections,
  ensureInfoPages,
  ensureInfoPagesFromStore,
  ensureMenu,
  ensureProducts,
  mergeSeedTheme,
  updateStoreSeo,
} from "./persist";
import { seedCatalogueImagesBatch, seedImagePathsFromStore } from "./images";
import { applyBestFitTheme } from "./theme-pick";
import { parseCachedSeedPlan, SEED_PLAN_AUDIT_ACTION, SEED_READY_AUDIT_ACTION, SEED_THEME_SOURCE } from "./phase-rules";
import type { ReadyStorePlan } from "./schemas";

/**
 * Phased ready-store seed for /start (each function is one small, idempotent server request on
 * Workers Free — 10 ms CPU). Callers resolve `ctx` from the user's own owner membership.
 *
 * The generated plan is cached in `audit_logs` (action `onboarding.seed_plan_generated`,
 * metadata.plan) — written by the existing audit helper, read back with the owner's session (RLS:
 * members.manage). The EARLIEST row wins, so a racing retry converges on one plan.
 */

export type SeedPlanInput = {
  storeName: string;
  industry: IndustrySlug;
  subcategory?: string | null;
  niche?: string | null;
  brief?: string;
  locale?: string;
};

const SEED_CREDIT_KIND = "onboarding_seed";

export function assertSeedPermissions(ctx: TenantContext): void {
  assertPermission(ctx, "catalog.write");
  assertPermission(ctx, "content.write");
  assertPermission(ctx, "theme.edit");
  assertPermission(ctx, "settings.write");
}

async function auditCount(tenantId: string, action: string, metadata?: Record<string, string>): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("action", action);
  if (metadata) q = q.contains("metadata", metadata);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

/** True once /start (or voice onboarding) finished seeding this store. */
export async function isStoreSeeded(tenantId: string): Promise<boolean> {
  return (await auditCount(tenantId, SEED_READY_AUDIT_ACTION)) > 0;
}

export async function readCachedSeedPlan(tenantId: string): Promise<ReadyStorePlan | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("action", SEED_PLAN_AUDIT_ACTION)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return parseCachedSeedPlan(data.metadata);
}

/** Step "theme": apply the chosen / best-fit marketplace theme as a draft, once. */
export async function seedThemePhase(ctx: TenantContext, industry: IndustrySlug, themeKey?: string): Promise<void> {
  assertSeedPermissions(ctx);
  if ((await auditCount(ctx.tenantId, "theme.marketplace_applied", { source: SEED_THEME_SOURCE })) > 0) return;
  try {
    const theme = await applyBestFitTheme(ctx, industry, themeKey);
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "theme.marketplace_applied",
      entityType: "theme",
      entityId: theme.key,
      metadata: { theme: theme.key, version: theme.version, source: SEED_THEME_SOURCE },
    });
  } catch (err) {
    // Same as the one-shot pipeline: a theme problem must not block the store.
    logger.warn("onboarding.seed_theme_skipped", {
      tenantId: ctx.tenantId,
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
  }
}

/** Step "plan": generate (AI, else built-in fallback) and cache the plan. Re-runs read the cache. */
export async function seedPlanPhase(ctx: TenantContext, input: SeedPlanInput): Promise<ReadyStorePlan> {
  assertSeedPermissions(ctx);
  const cached = await readCachedSeedPlan(ctx.tenantId);
  if (cached) return cached;
  let charge: Awaited<ReturnType<typeof debitAiCredit>> = null;
  try {
    charge = await debitAiCredit(ctx.tenantId, SEED_CREDIT_KIND);
  } catch (err) {
    charge = null;
    logger.warn("onboarding.seed_credit_skipped", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
  }
  let plan: ReadyStorePlan;
  try {
    plan = await generateReadyStorePlan(input);
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "Ready-store seed generation failed");
    throw err;
  }
  await audit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.user.id,
    action: SEED_PLAN_AUDIT_ACTION,
    entityType: "tenant",
    entityId: ctx.tenantId,
    metadata: { plan: plan as unknown as Json },
  });
  // A concurrent retry may have cached first: converge on the earliest plan.
  return (await readCachedSeedPlan(ctx.tenantId)) ?? plan;
}

/** Cached plan, else (when the caller has the draft) generate it now. */
export async function requireSeedPlan(ctx: TenantContext, input: SeedPlanInput): Promise<ReadyStorePlan> {
  return (await readCachedSeedPlan(ctx.tenantId)) ?? seedPlanPhase(ctx, input);
}

/** Step "categories": categories + collections (slug-idempotent). */
export async function seedCategoriesPhase(ctx: TenantContext, plan: ReadyStorePlan): Promise<void> {
  assertSeedPermissions(ctx);
  await ensureCategories(ctx.tenantId, plan);
  await ensureCollections(ctx.tenantId, plan);
}

/** Step "products": sample products (slug-idempotent; existing slugs are skipped). */
export async function seedProductsPhase(ctx: TenantContext, plan: ReadyStorePlan, industry: IndustrySlug, storeName: string): Promise<void> {
  assertSeedPermissions(ctx);
  const cats = await ensureCategories(ctx.tenantId, plan);
  await ensureProducts(ctx.tenantId, industry, plan, storeName, cats.ids);
}

/** Step "navigation": main menu (once) + store SEO / tagline / story. */
export async function seedNavigationPhase(ctx: TenantContext, plan: ReadyStorePlan, storeName: string): Promise<void> {
  assertSeedPermissions(ctx);
  const cats = await ensureCategories(ctx.tenantId, plan);
  await ensureMenu(ctx.tenantId, plan, cats.ids);
  await updateStoreSeo(ctx.tenantId, plan, storeName);
}

/** Phase "content": About / Contact pages and blog posts. No plan → pages from the saved store. */
export async function seedContentPhase(ctx: TenantContext, plan: ReadyStorePlan | null, storeName: string): Promise<void> {
  assertSeedPermissions(ctx);
  if (!plan) {
    await ensureInfoPagesFromStore(ctx.tenantId);
    return;
  }
  await ensureInfoPages(ctx.tenantId, storeName, plan.story);
  await ensureBlogs(ctx.tenantId, ctx.user.id, plan);
}

/** Phase "images": one batch of photo imports. Returns how many photos are still to fetch. */
export async function seedImagesPhase(ctx: TenantContext, industry: string, skip: readonly string[]): Promise<{ remaining: number; failed: string[] }> {
  assertSeedPermissions(ctx);
  try {
    return await seedCatalogueImagesBatch({ tenantId: ctx.tenantId, userId: ctx.user.id, industry, skip });
  } catch (err) {
    // Photos are a nice-to-have: never block the store on them.
    logger.warn("onboarding.seed_images_skipped", { tenantId: ctx.tenantId, message: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
    return { remaining: 0, failed: [] };
  }
}

/** Phase "publishTheme": homepage copy + photos into the theme draft, then publish the theme. */
export async function seedThemeMergePhase(ctx: TenantContext, plan: ReadyStorePlan | null, industry: string): Promise<void> {
  assertSeedPermissions(ctx);
  const paths = await seedImagePathsFromStore(ctx.tenantId, industry);
  await mergeSeedTheme(ctx, plan, paths);
}

/** Phase "finish": the ready-store audit row, once. */
export async function markStoreSeeded(ctx: TenantContext, metadata: Record<string, Json | undefined>): Promise<void> {
  if (await isStoreSeeded(ctx.tenantId)) return;
  await audit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.user.id,
    action: SEED_READY_AUDIT_ACTION,
    entityType: "tenant",
    entityId: ctx.tenantId,
    metadata,
  });
}
