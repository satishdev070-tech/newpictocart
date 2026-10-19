import "server-only";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { audit } from "@/lib/audit";
import { assertPermission, type TenantContext } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debitAiCredit, refundAiCredit } from "@/features/ai-credits/server";
import type { IndustrySlug } from "@/features/stores/industries";
import { generateReadyStorePlan, parseReadyStorePlan } from "./generate";
import { persistReadyStore } from "./persist";
import { applyBestFitTheme, pickBestMarketplaceTheme } from "./theme-pick";
import { READY_STORE_COUNTS } from "./counts";
import { seedReadyStoreInputSchema, type ReadyStorePlan, type SeedReadyStoreInput, type SeedReadyStoreResult } from "./schemas";

const SEED_CREDIT_KIND = "onboarding_seed";

async function wasAlreadySeeded(tenantId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("action", "onboarding.ready_store_seeded")
    .limit(1);
  if (error) {
    // Audit table readable? If not, fall through and rely on slug idempotency.
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Orchestrated ready-store seed for one tenant (idempotent):
 * 1) best-fit marketplace theme (optional)
 * 2) Sarvam structured plan (or caller-supplied plan)
 * 3) persist categories, products, nav, SEO, blogs, theme section merge
 *
 * Call after create_tenant. Requires an authorised owner TenantContext.
 */
export async function seedReadyStore(ctx: TenantContext, raw: Omit<SeedReadyStoreInput, "tenantId"> & { tenantId?: string }): Promise<SeedReadyStoreResult> {
  const input = seedReadyStoreInputSchema.parse({ ...raw, tenantId: raw.tenantId ?? ctx.tenantId });
  if (input.tenantId !== ctx.tenantId) throw new AppError("FORBIDDEN");

  assertPermission(ctx, "catalog.write");
  assertPermission(ctx, "content.write");
  assertPermission(ctx, "theme.edit");
  assertPermission(ctx, "settings.write");

  const industry = input.industry as IndustrySlug;
  const alreadySeeded = await wasAlreadySeeded(ctx.tenantId);

  // Fully seeded tenants: no-op unless the caller supplies a plan (gap-fill / refresh).
  if (alreadySeeded && input.plan === undefined) {
    const supabase = await createSupabaseServerClient();
    const [{ count: catCount }, { count: productCount }] = await Promise.all([
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId),
    ]);
    if ((catCount ?? 0) >= READY_STORE_COUNTS.categories && (productCount ?? 0) >= READY_STORE_COUNTS.products) {
      return {
        themeKey: input.themeKey ?? pickBestMarketplaceTheme(industry).key,
        categoryIds: [],
        productIds: [],
        collectionIds: [],
        blogIds: [],
        menuId: null,
        skipped: {
          categories: READY_STORE_COUNTS.categories,
          products: READY_STORE_COUNTS.products,
          collections: 0,
          blogs: READY_STORE_COUNTS.blogs,
          menu: true,
        },
        alreadySeeded: true,
      };
    }
  }

  let themeKey: string | null = null;
  if (input.applyTheme) {
    try {
      const theme = await applyBestFitTheme(ctx, industry, input.themeKey);
      themeKey = theme.key;
      await audit({
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        action: "theme.marketplace_applied",
        entityType: "theme",
        entityId: theme.key,
        metadata: { theme: theme.key, version: theme.version, source: "onboarding_seed" },
      });
    } catch (err) {
      logger.warn("onboarding.seed_theme_skipped", {
        tenantId: ctx.tenantId,
        message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      });
      themeKey = input.themeKey ?? null;
    }
  } else {
    try {
      themeKey = input.themeKey ?? pickBestMarketplaceTheme(industry).key;
    } catch {
      themeKey = input.themeKey ?? null;
    }
  }

  let plan: ReadyStorePlan;
  let charge: Awaited<ReturnType<typeof debitAiCredit>> = null;
  if (input.plan !== undefined) {
    plan = parseReadyStorePlan(input.plan);
  } else {
    try {
      charge = await debitAiCredit(ctx.tenantId, SEED_CREDIT_KIND);
    } catch (err) {
      // A brand-new store must still get a catalogue when credits are missing or the debit is refused.
      charge = null;
      logger.warn("onboarding.seed_credit_skipped", {
        tenantId: ctx.tenantId,
        message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      });
    }
    try {
      plan = await generateReadyStorePlan({
        storeName: input.storeName,
        industry,
        brief: input.brief,
        locale: input.locale,
      });
    } catch (err) {
      await refundAiCredit(charge, err instanceof Error ? err.message : "Ready-store seed generation failed");
      throw err;
    }
  }

  try {
    const persisted = await persistReadyStore(ctx, { storeName: input.storeName, industry, plan });
    await audit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.user.id,
      action: "onboarding.ready_store_seeded",
      entityType: "tenant",
      entityId: ctx.tenantId,
      metadata: {
        themeKey,
        categories: persisted.categoryIds.length,
        products: persisted.productIds.length,
        blogs: persisted.blogIds.length,
        skipped: persisted.skipped,
        alreadySeeded,
      },
    });
    return { ...persisted, themeKey, alreadySeeded };
  } catch (err) {
    await refundAiCredit(charge, err instanceof Error ? err.message : "Ready-store seed persist failed");
    throw err;
  }
}

/** Programmatic entry that only needs tenantId + fields (builds owner checks in the action layer). */
export type SeedReadyStoreArgs = {
  tenantId: string;
  storeName: string;
  industry: IndustrySlug;
  brief?: string;
  locale?: string;
  applyTheme?: boolean;
  themeKey?: string;
  plan?: unknown;
};
