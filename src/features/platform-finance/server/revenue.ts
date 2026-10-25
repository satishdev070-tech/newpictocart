import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { toMinor } from "@/lib/money";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { aiCallCostMinor, profitSummary, subscriptionBreakdown, type PlanBreakdownRow, type ProfitSummary } from "../calc";
import { aiCostByModel, commissionOnGmv, modelKey, themeAdoption, type ModelCostRow, type ThemeAdoptionRow } from "../schemas";

/**
 * Revenue P&L reads for /admin/revenue. RLS-scoped server client only: plans, tenants and
 * credit purchases through their platform policies; GMV and AI usage through the
 * platform_* SECURITY DEFINER functions (migration 3700), which check platform.finance.read.
 */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PAGE = 1000;
const MAX_ROWS = 50_000;

type PgErr = { code?: string; message?: string } | null;

/** Reads every row of a list query in pages (PostgREST caps a response at 1,000 rows). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgErr }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw mapDbError(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

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

/** Thrown when migration 3700 is not applied yet; the page shows a "pending migration" notice. */
class PendingMigration extends Error {}

function failOn(error: PgErr): void {
  if (!error) return;
  if (isMissingSchemaError(error)) throw new PendingMigration();
  throw mapDbError(error);
}

async function gmvByTenant(db: Db, from: string | null) {
  const { data, error } = await db.rpc("platform_gmv_by_tenant", from ? { p_from: from } : {});
  failOn(error);
  return (data ?? []).map((r) => ({ tenantId: r.tenant_id, gmvMinor: toMinor(String(r.gmv)) }));
}

async function aiUsage(db: Db, from: string | null) {
  const { data, error } = await db.rpc("platform_ai_usage", from ? { p_from: from } : {});
  failOn(error);
  return (data ?? []).map((r) => ({ provider: r.provider, model: r.model, calls: Number(r.calls), tokens: Number(r.tokens) }));
}

const tokenCost = (tokens: number, perMillionMinor: number) => aiCallCostMinor(tokens, 0, { inputPerMillionMinor: perMillionMinor, outputPerMillionMinor: 0 });

export async function getRevenueReport(now: Date = new Date()): Promise<RevenueReport> {
  try {
    return await buildReport(now);
  } catch (e) {
    if (e instanceof PendingMigration) return { ready: false };
    throw e;
  }
}

async function buildReport(now: Date): Promise<RevenueReport> {
  const db = await createSupabaseServerClient();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const { data: plans, error: plansError } = await db
    .from("plans")
    .select("id, name, price_monthly, price_yearly, commission_bps, sort_order")
    .order("sort_order")
    .order("price_monthly")
    .limit(200);
  failOn(plansError);

  const [gmv30, gmvAll, ai30, aiAll, priceRes] = await Promise.all([
    gmvByTenant(db, since),
    gmvByTenant(db, null),
    aiUsage(db, since),
    aiUsage(db, null),
    db.from("ai_model_prices").select("provider, model, price_per_million").limit(1000),
  ]);
  // Model prices arrive with migration 3900; without it every model is "unpriced".
  if (priceRes.error && !isMissingSchemaError(priceRes.error)) throw mapDbError(priceRes.error);

  const [tenants, credits, published] = await Promise.all([
    fetchAll((from, to) => db.from("tenants").select("id, status, plan_id").order("id").range(from, to)),
    fetchAll((from, to) => db.from("ai_credit_purchase_requests").select("amount, decided_at").eq("status", "approved").order("id").range(from, to)),
    fetchAll((from, to) => db.from("theme_versions").select("tenant_id, theme_key, label").eq("status", "published").order("id").range(from, to)),
  ]);

  const planInfo = (plans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceMonthlyMinor: toMinor(String(p.price_monthly)),
    priceYearlyMinor: toMinor(String(p.price_yearly)),
    commissionBps: p.commission_bps,
    sortOrder: p.sort_order,
  }));
  const breakdown = subscriptionBreakdown(
    planInfo,
    tenants.map((t) => ({ planId: t.plan_id, status: t.status })),
  );

  // Commission = each store's GMV × its current plan rate.
  const rateByPlan = new Map(planInfo.map((p) => [p.id, p.commissionBps]));
  const rateByTenant = new Map(tenants.map((t) => [t.id, t.plan_id ? (rateByPlan.get(t.plan_id) ?? 0) : 0]));
  const commission30 = commissionOnGmv(gmv30, rateByTenant);
  const commissionLifetime = commissionOnGmv(gmvAll, rateByTenant);

  let creditPacks30Minor = 0;
  let creditPacksLifetimeMinor = 0;
  let creditPacks30Count = 0;
  for (const c of credits) {
    const amount = toMinor(String(c.amount));
    creditPacksLifetimeMinor += amount;
    if (c.decided_at && c.decided_at >= since) {
      creditPacks30Minor += amount;
      creditPacks30Count += 1;
    }
  }

  const prices = new Map((priceRes.data ?? []).map((p) => [modelKey(p.provider, p.model), toMinor(String(p.price_per_million))]));
  const cost30 = aiCostByModel(ai30, prices, tokenCost);
  const costAll = aiCostByModel(aiAll, prices, tokenCost);

  // Marketplace themes are free presets: theme sales are ₹0 in both periods.
  const themeSalesMinor = 0;
  const profit = profitSummary(
    { subscriptionsMinor: breakdown.mrrMinor, commissionMinor: commission30.commissionMinor, creditPacksMinor: creditPacks30Minor, themeSalesMinor },
    // No subscription payment ledger: lifetime uses current MRR for the subscription part.
    { subscriptionsMinor: breakdown.mrrMinor, commissionMinor: commissionLifetime.commissionMinor, creditPacksMinor: creditPacksLifetimeMinor, themeSalesMinor },
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
    creditPacks30Minor,
    creditPacksLifetimeMinor,
    creditPacks30Count,
    aiCost30Minor: cost30.totalMinor,
    aiCostLifetimeMinor: costAll.totalMinor,
    aiModels: costAll.rows,
    unpricedModels: costAll.unpriced,
    profit,
    themes: themeAdoption(published.map((p) => ({ tenantId: p.tenant_id, themeKey: p.theme_key, label: p.label }))),
  };
}
