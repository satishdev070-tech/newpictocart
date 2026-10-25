import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import { toMinor } from "@/lib/money";
import { FALLBACK_PACKS, type AiCreditCatalog, type AiCreditLedgerRow, type AiCreditPurchaseRow } from "./schemas";

const MISSING_SCHEMA_CODES = new Set(["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"]);

function missingSchema(error: { code?: string } | null | undefined) {
  return MISSING_SCHEMA_CODES.has(error?.code ?? "");
}

/** A null charge means the migration has not been applied yet. AI deliberately fails open during rollout. */
export type AiCreditCharge = { ledgerId: string; balance: number } | null;

export async function debitAiCredit(tenantId: string, kind: string): Promise<AiCreditCharge> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("ai_credit_debit", { p_tenant: tenantId, p_kind: kind, p_reference: null });
  if (error) {
    if (missingSchema(error)) {
      logger.warn("ai_credits.schema_pending", { operation: "debit", code: error.code });
      return null;
    }
    if (error.hint === "AI_CREDITS_EXHAUSTED") throw new AppError("CONFLICT", { fieldErrors: { _form: ["You have no AI credits left. Buy more credits to continue."] }, context: { reason: "ai_credits_exhausted" } });
    throw new AppError("INTERNAL", { context: { operation: "ai_credit_debit", code: error.code } });
  }
  const row = data?.[0];
  if (!row) throw new AppError("INTERNAL", { context: { operation: "ai_credit_debit_empty" } });
  return { ledgerId: row.ledger_id, balance: row.balance };
}

/** Best effort: never mask the original provider error if the refund itself is temporarily unavailable. */
export async function refundAiCredit(charge: AiCreditCharge, note: string): Promise<void> {
  if (!charge) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ai_credit_refund", { p_ledger: charge.ledgerId, p_note: note.slice(0, 500) });
  if (error) logger.error("ai_credits.refund_failed", { ledgerId: charge.ledgerId, code: error.code });
}

export type AiCreditOverview = {
  available: boolean;
  balance: number;
  ledger: AiCreditLedgerRow[];
  purchases: AiCreditPurchaseRow[];
  catalog: AiCreditCatalog;
};

const FALLBACK_CATALOG: AiCreditCatalog = { configurable: false, packs: FALLBACK_PACKS, costs: [], custom: null };

/**
 * What a seller can buy and what each AI action costs (migration 3900 tables, readable by any
 * signed-in user). Falls back to the fixed 3400 packs, without custom amounts or promos, while
 * the migration is pending.
 */
export async function getAiCreditCatalog(): Promise<AiCreditCatalog> {
  const supabase = await createSupabaseServerClient();
  const [packs, costs, settings] = await Promise.all([
    supabase.from("ai_credit_packs").select("code, label, credits, price, sort_order").eq("active", true).order("sort_order").order("code"),
    supabase.from("ai_credit_action_costs").select("kind, label, credits").order("credits", { ascending: false }).order("label"),
    supabase.from("ai_credit_settings").select("custom_min, custom_max, custom_credits_per_rupee").eq("id", 1).maybeSingle(),
  ]);
  const firstError = packs.error ?? costs.error ?? settings.error;
  if (firstError) {
    if (!missingSchema(firstError)) logger.warn("ai_credits.catalog_unavailable", { code: firstError.code });
    return FALLBACK_CATALOG;
  }
  return {
    configurable: true,
    packs: (packs.data ?? []).map((p) => ({ code: p.code, label: p.label, credits: p.credits, priceMinor: toMinor(String(p.price)), sortOrder: p.sort_order })),
    costs: (costs.data ?? []).map((c) => ({ kind: c.kind, label: c.label, credits: c.credits })),
    custom: settings.data ? { minMinor: toMinor(String(settings.data.custom_min)), maxMinor: toMinor(String(settings.data.custom_max)), creditsPerRupee: settings.data.custom_credits_per_rupee } : null,
  };
}

/** Lightweight header value. Returns null during the staged migration rollout. */
export async function getAiCreditBalance(tenantId: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ai_credit_accounts").select("balance").eq("tenant_id", tenantId).maybeSingle();
  if (error) {
    if (missingSchema(error)) return null;
    logger.warn("ai_credits.balance_unavailable", { code: error.code });
    return null;
  }
  return data?.balance ?? 0;
}

/** Seller-owned data only; callers must have checked the matching tenant membership/permission. */
export async function getAiCreditOverview(tenantId: string, limit = 30): Promise<AiCreditOverview> {
  const supabase = await createSupabaseServerClient();
  const [account, ledger, purchases, catalog] = await Promise.all([
    supabase.from("ai_credit_accounts").select("balance").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("ai_credit_ledger").select("id, delta, balance_after, kind, note, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("ai_credit_purchase_requests").select("id, tenant_id, pack, credits, amount, method, status, decision_note, payment_reference, created_at, decided_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit),
    getAiCreditCatalog(),
  ]);
  const firstError = account.error ?? ledger.error ?? purchases.error;
  if (firstError) {
    if (missingSchema(firstError)) return { available: false, balance: 0, ledger: [], purchases: [], catalog };
    throw new AppError("INTERNAL", { context: { operation: "ai_credit_overview", code: firstError.code } });
  }
  return {
    available: true,
    catalog,
    balance: account.data?.balance ?? 0,
    ledger: (ledger.data ?? []).map((r) => ({ id: r.id, delta: r.delta, balanceAfter: r.balance_after, kind: r.kind, note: r.note, createdAt: r.created_at })),
    purchases: (purchases.data ?? []).map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      pack: r.pack,
      credits: r.credits,
      amountMinor: toMinor(r.amount),
      method: r.method as "online" | "offline",
      status: r.status as AiCreditPurchaseRow["status"],
      decisionNote: r.decision_note,
      paymentReference: r.payment_reference,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    })),
  };
}

/** Super-admin queue/history; the RLS policy independently limits this to platform usage staff. */
export async function getPlatformAiCreditOverview(limit = 100): Promise<{ available: boolean; ledger: (AiCreditLedgerRow & { tenantId: string })[]; purchases: AiCreditPurchaseRow[] }> {
  const supabase = await createSupabaseServerClient();
  const [ledger, purchases] = await Promise.all([
    supabase.from("ai_credit_ledger").select("id, tenant_id, delta, balance_after, kind, note, created_at").order("created_at", { ascending: false }).limit(limit),
    supabase.from("ai_credit_purchase_requests").select("id, tenant_id, pack, credits, amount, method, status, decision_note, payment_reference, created_at, decided_at").order("created_at", { ascending: false }).limit(limit),
  ]);
  const firstError = ledger.error ?? purchases.error;
  if (firstError) {
    if (missingSchema(firstError)) return { available: false, ledger: [], purchases: [] };
    throw new AppError("INTERNAL", { context: { operation: "platform_ai_credit_overview", code: firstError.code } });
  }
  return {
    available: true,
    ledger: (ledger.data ?? []).map((r) => ({ id: r.id, tenantId: r.tenant_id, delta: r.delta, balanceAfter: r.balance_after, kind: r.kind, note: r.note, createdAt: r.created_at })),
    purchases: (purchases.data ?? []).map((r) => ({ id: r.id, tenantId: r.tenant_id, pack: r.pack, credits: r.credits, amountMinor: toMinor(r.amount), method: r.method as "online" | "offline", status: r.status as AiCreditPurchaseRow["status"], decisionNote: r.decision_note, paymentReference: r.payment_reference, createdAt: r.created_at, decidedAt: r.decided_at })),
  };
}
