import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { toMinor } from "@/lib/money";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { aiCallCostMinor, profitSummary, subscriptionBreakdownFromCounts, type PlanBreakdownRow, type ProfitSummary } from "../calc";
import { aiCostByModel, commissionOnGmv, modelKey, type ModelCostRow, type ThemeAdoptionRow } from "../schemas";
import { logSpan, timeAsync } from "@/lib/observability/timing";
import { withSpan } from "@/lib/observability/spans";

/**
 * Revenue P&L reads for /admin/revenue. RLS-scoped server client only: plans and
 * model prices through their platform policies; GMV, AI usage, credit packs, tenant
 * counts and theme adoption through platform_revenue_report (migration 7100), which
 * checks platform.finance.read. Dual lifetime scans and full-table fetchAll are gone.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type PgErr = { code?: string; message?: string } | null;

export type RevenueReport =
  | { ready: false }
  | {
      ready: true;
      mrrMinor: number;
      paying: number;
      trial: number;
      totalStores: number;
      plans: PlanBreakdownRow[];
      commission30: { gmvMinor: number; commissionMinor: number };
      commissionLifetime: { gmvMinor: number; commissionMinor: number };
      creditPacks30Minor: number;
      creditPacksLifetimeMinor: number;
      creditPacks30Count: number;
      aiCost30Minor: number;
      aiCostLifetimeMinor: number;
      aiModels: ModelCostRow[];
      unpricedModels: ModelCostRow[];
      profit: ProfitSummary;
      themes: ThemeAdoptionRow[];
    };

/** Thrown when migration 3700/7100 is not applied yet; the page shows a "pending migration" notice. */
class PendingMigration extends Error {}

function failOn(error: PgErr): void {
  if (!error) return;
  if (isMissingSchemaError(error)) throw new PendingMigration();
  throw mapDbError(error);
}

const moneyText = z.union([z.string(), z.number()]).transform((v) => toMinor(String(v)));
const gmvRow = z.object({
  tenant_id: z.string().uuid(),
  gmv: moneyText,
  commission_bps: z.coerce.number().int().min(0).max(10_000).catch(0),
});
const aiRow = z.object({
  provider: z.string(),
  model: z.string(),
  calls: z.coerce.number(),
  tokens: z.coerce.number(),
});
const revenueBundleSchema = z.object({
  gmv_period: z.array(gmvRow).catch([]),
  gmv_lifetime: z.array(gmvRow).catch([]),
  ai_period: z.array(aiRow).catch([]),
  ai_lifetime: z.array(aiRow).catch([]),
  credits: z
    .object({
      lifetime: moneyText.catch(0),
      period: moneyText.catch(0),
      period_count: z.coerce.number().catch(0),
    })
    .catch({ lifetime: 0, period: 0, period_count: 0 }),
  tenant_counts: z
    .array(
      z.object({
        plan_id: z.string().uuid().nullable().catch(null),
        status: z.string(),
        count: z.coerce.number(),
      }),
    )
    .catch([]),
  themes: z
    .array(
      z.object({
        theme_key: z.string(),
        label: z.string(),
        stores: z.coerce.number(),
      }),
    )
    .catch([]),
});

const tokenCost = (tokens: number, perMillionMinor: number) => aiCallCostMinor(tokens, 0, { inputPerMillionMinor: perMillionMinor, outputPerMillionMinor: 0 });

async function timedWave<T>(span: string, fn: () => Promise<T>): Promise<T> {
  const { result, ms } = await timeAsync(span, fn);
  logSpan({ span, ms });
  return result;
}

function ratesFromGmv(rows: readonly { tenant_id: string; commission_bps: number }[]): Map<string, number> {
  const rateByTenant = new Map<string, number>();
  for (const r of rows) rateByTenant.set(r.tenant_id, r.commission_bps);
  return rateByTenant;
}

export async function getRevenueReport(now: Date = new Date()): Promise<RevenueReport> {
  return withSpan("admin.revenue.report", async () => {
    try {
      return await buildReport(now);
    } catch (e) {
      if (e instanceof PendingMigration) return { ready: false };
      throw e;
    }
  });
}

async function buildReport(now: Date): Promise<RevenueReport> {
  const db = await createSupabaseServerClient();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const plans = await timedWave("admin.revenue.plans", async () => {
    const { data, error } = await db.from("plans").select("id, name, price_monthly, price_yearly, commission_bps, sort_order").order("sort_order").order("price_monthly").limit(200);
    failOn(error);
    return data ?? [];
  });

  const [bundle, priceRes] = await Promise.all([
    timedWave("admin.revenue.bundle", () => loadRevenueBundle(db, since)),
    timedWave("admin.revenue.prices", async () => {
      const res = await db.from("ai_model_prices").select("provider, model, price_per_million").limit(1000);
      // Model prices arrive with migration 3900; without it every model is "unpriced".
      if (res.error && !isMissingSchemaError(res.error)) throw mapDbError(res.error);
      return res;
    }),
  ]);

  const planInfo = plans.map((p) => ({
    id: p.id,
    name: p.name,
    priceMonthlyMinor: toMinor(String(p.price_monthly)),
    priceYearlyMinor: toMinor(String(p.price_yearly)),
    commissionBps: p.commission_bps,
    sortOrder: p.sort_order,
  }));
  const breakdown = subscriptionBreakdownFromCounts(
    planInfo,
    bundle.tenant_counts.map((t) => ({ planId: t.plan_id, status: t.status, count: t.count })),
  );

  // Commission = each store's GMV × its current plan rate (bps come from the RPC join).
  const rateByTenant = ratesFromGmv([...bundle.gmv_period, ...bundle.gmv_lifetime]);
  const gmv30 = bundle.gmv_period.map((r) => ({ tenantId: r.tenant_id, gmvMinor: r.gmv }));
  const gmvAll = bundle.gmv_lifetime.map((r) => ({ tenantId: r.tenant_id, gmvMinor: r.gmv }));
  const commission30 = commissionOnGmv(gmv30, rateByTenant);
  const commissionLifetime = commissionOnGmv(gmvAll, rateByTenant);

  const prices = new Map((priceRes.data ?? []).map((p) => [modelKey(p.provider, p.model), toMinor(String(p.price_per_million))]));
  const cost30 = aiCostByModel(
    bundle.ai_period.map((r) => ({ provider: r.provider, model: r.model, calls: r.calls, tokens: r.tokens })),
    prices,
    tokenCost,
  );
  const costAll = aiCostByModel(
    bundle.ai_lifetime.map((r) => ({ provider: r.provider, model: r.model, calls: r.calls, tokens: r.tokens })),
    prices,
    tokenCost,
  );

  // Marketplace themes are free presets: theme sales are ₹0 in both periods.
  const themeSalesMinor = 0;
  const profit = profitSummary(
    { subscriptionsMinor: breakdown.mrrMinor, commissionMinor: commission30.commissionMinor, creditPacksMinor: bundle.credits.period, themeSalesMinor },
    // No subscription payment ledger: lifetime uses current MRR for the subscription part.
    { subscriptionsMinor: breakdown.mrrMinor, commissionMinor: commissionLifetime.commissionMinor, creditPacksMinor: bundle.credits.lifetime, themeSalesMinor },
    { monthlyMinor: cost30.totalMinor, lifetimeMinor: costAll.totalMinor },
  );

  return {
    ready: true,
    mrrMinor: breakdown.mrrMinor,
    paying: breakdown.paying,
    trial: breakdown.trial,
    totalStores: breakdown.total,
    plans: breakdown.rows,
    commission30,
    commissionLifetime,
    creditPacks30Minor: bundle.credits.period,
    creditPacksLifetimeMinor: bundle.credits.lifetime,
    creditPacks30Count: bundle.credits.period_count,
    aiCost30Minor: cost30.totalMinor,
    aiCostLifetimeMinor: costAll.totalMinor,
    aiModels: costAll.rows,
    unpricedModels: costAll.unpriced,
    profit,
    themes: bundle.themes.map((t) => ({ themeKey: t.theme_key, label: t.label, stores: t.stores })),
  };
}

async function loadRevenueBundle(db: Db, since: string) {
  const { data, error } = await db.rpc("platform_revenue_report", { p_from: since });
  failOn(error);
  return revenueBundleSchema.parse(data ?? {});
}
