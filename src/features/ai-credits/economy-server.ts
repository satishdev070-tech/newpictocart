import "server-only";
import { AppError } from "@/lib/errors";
import { toMinor } from "@/lib/money";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError, sanitizeSearchTerm } from "@/features/platform/schemas";
import { DEFAULT_CREDIT_PRICING, type CreditPricing } from "@/features/platform-finance/calc";
import { parseInsights, pricingFromRow, type ActionCostRow, type CreditInsights, type PackRow, type PromoRow } from "./economy-schemas";

/** Super Admin → Credits economy reads. RLS also limits writes and promo reads to platform.settings.manage. */

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type Loaded<T> = { available: boolean; data: T };

function fail(error: { code?: string }, operation: string): never {
  throw new AppError("INTERNAL", { context: { operation, code: error.code } });
}

async function db(ctx: PlatformContext): Promise<Db> {
  assertPlatformPermission(ctx, "platform.settings.manage");
  return createSupabaseServerClient();
}

export async function getCreditPricing(ctx: PlatformContext): Promise<Loaded<CreditPricing>> {
  const { data, error } = await (await db(ctx)).from("ai_credit_settings").select("base_cost_per_credit, margin_multiplier, custom_credits_per_rupee, custom_min, custom_max, welcome_credits, low_balance, critical_balance, freelancer_hourly").eq("id", 1).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: { ...DEFAULT_CREDIT_PRICING } };
    fail(error, "ai_credit_settings_read");
  }
  return { available: true, data: pricingFromRow(data) };
}

export async function listActionCosts(ctx: PlatformContext): Promise<Loaded<ActionCostRow[]>> {
  const { data, error } = await (await db(ctx)).from("ai_credit_action_costs").select("kind, label, credits, minutes_saved").order("kind");
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: [] };
    fail(error, "ai_credit_action_costs_read");
  }
  return { available: true, data: (data ?? []).map((r) => ({ kind: r.kind, label: r.label, credits: r.credits, minutesSaved: r.minutes_saved })) };
}

export async function listPacks(ctx: PlatformContext): Promise<Loaded<PackRow[]>> {
  const { data, error } = await (await db(ctx)).from("ai_credit_packs").select("code, label, credits, price, active, sort_order").order("sort_order").order("code");
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: [] };
    fail(error, "ai_credit_packs_read");
  }
  return { available: true, data: (data ?? []).map((r) => ({ code: r.code, label: r.label, credits: r.credits, priceMinor: toMinor(String(r.price)), active: r.active, sortOrder: r.sort_order })) };
}

export async function listPromos(ctx: PlatformContext): Promise<Loaded<PromoRow[]>> {
  const { data, error } = await (await db(ctx)).from("ai_credit_promos").select("id, code, bonus_pct, starts_at, ends_at, max_uses, uses, active, created_at").order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: [] };
    fail(error, "ai_credit_promos_read");
  }
  return { available: true, data: (data ?? []).map((r) => ({ id: r.id, code: r.code, bonusPct: r.bonus_pct, startsAt: r.starts_at, endsAt: r.ends_at, maxUses: r.max_uses, uses: r.uses, active: r.active, createdAt: r.created_at })) };
}

/** Recent purchase requests per promo code (who used it). */
export async function listPromoUses(ctx: PlatformContext): Promise<Record<string, { tenantName: string; credits: number; bonus: number; status: string; createdAt: string }[]>> {
  const { data, error } = await (await db(ctx)).from("ai_credit_purchase_requests").select("promo_code, credits, bonus_credits, status, created_at, tenants(name)").not("promo_code", "is", null).order("created_at", { ascending: false }).limit(300);
  if (error) {
    if (isMissingSchemaError(error)) return {};
    fail(error, "ai_credit_promo_uses_read");
  }
  const out: Record<string, { tenantName: string; credits: number; bonus: number; status: string; createdAt: string }[]> = {};
  for (const r of data ?? []) {
    if (!r.promo_code) continue;
    const t = r.tenants as { name: string } | { name: string }[] | null;
    (out[r.promo_code] ??= []).push({ tenantName: (Array.isArray(t) ? t[0]?.name : t?.name) ?? "Unknown store", credits: r.credits, bonus: r.bonus_credits, status: r.status, createdAt: r.created_at });
  }
  return out;
}

export async function getCreditInsights(ctx: PlatformContext): Promise<Loaded<CreditInsights | null>> {
  const { data, error } = await (await db(ctx)).rpc("platform_ai_credit_insights");
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, data: null };
    fail(error, "platform_ai_credit_insights");
  }
  return { available: true, data: parseInsights(data) };
}

export type StoreCreditRow = { id: string; name: string; slug: string; balance: number | null };

/** Store picker for manual grants: name/slug search, with the current credit balance. */
export async function searchStoresForGrant(ctx: PlatformContext, rawQ: string | undefined): Promise<StoreCreditRow[]> {
  const supabase = await db(ctx);
  const q = sanitizeSearchTerm(rawQ);
  let query = supabase.from("tenants").select("id, name, slug").order("created_at", { ascending: false }).limit(20);
  if (q) query = query.or(`name.ilike.*${q}*,slug.ilike.*${q}*`);
  const { data, error } = await query;
  if (error) fail(error, "grant_store_search");
  const ids = (data ?? []).map((t) => t.id);
  const balances = new Map<string, number>();
  if (ids.length) {
    const acc = await supabase.from("ai_credit_accounts").select("tenant_id, balance").in("tenant_id", ids);
    if (acc.error && !isMissingSchemaError(acc.error)) fail(acc.error, "grant_store_balances");
    for (const a of acc.data ?? []) balances.set(a.tenant_id, a.balance);
  }
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug, balance: balances.get(t.id) ?? null }));
}
