/**
 * Pure Super Admin finance maths (no I/O, unit tested in tests/unit/platform-finance/calc.test.ts).
 * Every amount is integer paise (src/lib/money.ts); rates are integer basis points (1% = 100 bps)
 * so nothing here ever multiplies a float by money.
 */

export const BPS = 10_000;

/** Commission on an amount at a rate in basis points, rounded half-up to the paisa. */
export function applyBps(amountMinor: number, rateBps: number): number {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(rateBps)) throw new RangeError("amount and rate must be integers");
  if (rateBps < 0 || rateBps > BPS) throw new RangeError("rate must be between 0 and 10000 bps");
  const sign = amountMinor < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(amountMinor) * rateBps + BPS / 2) / BPS);
}

/** "2%" → 200 bps, "1.5" → 150; percentages with up to two decimals. */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new RangeError("percent must be 0–100");
  return Math.round(percent * 100);
}

export function bpsToPercentLabel(bps: number): string {
  const p = bps / 100;
  return `${Number.isInteger(p) ? p : p.toFixed(2).replace(/0$/, "")}%`;
}

// ---- MRR / subscriptions ---------------------------------------------------------------

export type SubscriptionStatus = "active" | "trial" | "suspended" | "cancelled" | "past_due" | string;
export type BillingCycle = "monthly" | "yearly";

export type StoreSubscription = {
  planId: string | null;
  status: SubscriptionStatus;
  /** Plan list prices in paise. */
  priceMonthlyMinor: number;
  priceYearlyMinor: number;
  cycle?: BillingCycle | null;
};

/** Monthly recurring revenue of one store: yearly plans count as a twelfth (rounded down). */
export function storeMrrMinor(s: StoreSubscription): number {
  if (s.status !== "active") return 0;
  if (s.cycle === "yearly" && s.priceYearlyMinor > 0) return Math.floor(s.priceYearlyMinor / 12);
  return Math.max(0, s.priceMonthlyMinor);
}

export type PlanBreakdownRow = {
  planId: string | null;
  planName: string;
  stores: number;
  paying: number;
  trial: number;
  priceMonthlyMinor: number;
  commissionBps: number;
  mrrMinor: number;
};

export type PlanInfo = { id: string; name: string; priceMonthlyMinor: number; priceYearlyMinor: number; commissionBps: number; sortOrder?: number };

/**
 * Subscription breakdown + MRR. A store is "paying" when active on a plan with a price; trial
 * stores never count towards MRR. Stores without a plan are grouped under "No plan".
 */
export function subscriptionBreakdown(
  plans: readonly PlanInfo[],
  stores: readonly { planId: string | null; status: SubscriptionStatus; cycle?: BillingCycle | null }[],
): { rows: PlanBreakdownRow[]; mrrMinor: number; paying: number; trial: number; total: number } {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const rows = new Map<string, PlanBreakdownRow>();
  for (const p of plans) {
    rows.set(p.id, { planId: p.id, planName: p.name, stores: 0, paying: 0, trial: 0, priceMonthlyMinor: p.priceMonthlyMinor, commissionBps: p.commissionBps, mrrMinor: 0 });
  }
  let mrrMinor = 0;
  let paying = 0;
  let trial = 0;
  for (const s of stores) {
    if (s.status === "cancelled") continue;
    const plan = s.planId ? byId.get(s.planId) : undefined;
    const key = plan ? plan.id : "__none__";
    let row = rows.get(key);
    if (!row) {
      row = { planId: null, planName: "No plan", stores: 0, paying: 0, trial: 0, priceMonthlyMinor: 0, commissionBps: 0, mrrMinor: 0 };
      rows.set(key, row);
    }
    row.stores += 1;
    if (s.status === "trial") {
      row.trial += 1;
      trial += 1;
      continue;
    }
    const mrr = plan ? storeMrrMinor({ planId: plan.id, status: s.status, priceMonthlyMinor: plan.priceMonthlyMinor, priceYearlyMinor: plan.priceYearlyMinor, cycle: s.cycle }) : 0;
    if (mrr > 0) {
      row.paying += 1;
      paying += 1;
      row.mrrMinor += mrr;
      mrrMinor += mrr;
    }
  }
  const order = new Map(plans.map((p, i) => [p.id, p.sortOrder ?? i]));
  const list = [...rows.values()]
    .filter((r) => r.stores > 0 || r.planId)
    .sort((a, b) => (a.planId ? (order.get(a.planId) ?? 0) : 1e9) - (b.planId ? (order.get(b.planId) ?? 0) : 1e9));
  return { rows: list, mrrMinor, paying, trial, total: list.reduce((n, r) => n + r.stores, 0) };
}

// ---- Net profit ---------------------------------------------------------------------------

export type RevenueStreams = { subscriptionsMinor: number; commissionMinor: number; creditPacksMinor: number; themeSalesMinor: number };

export function grossMinor(r: RevenueStreams): number {
  return r.subscriptionsMinor + r.commissionMinor + r.creditPacksMinor + r.themeSalesMinor;
}

/** Net after AI cost. Can go negative (shown as a loss), never silently clamped. */
export function netAfterAiMinor(gross: number, aiCostMinor: number): number {
  return gross - Math.max(0, aiCostMinor);
}

export function marginBps(net: number, gross: number): number {
  if (gross <= 0) return 0;
  return Math.round((net * BPS) / gross);
}

export type ProfitSummary = { grossMonthlyMinor: number; netMonthlyMinor: number; grossLifetimeMinor: number; netLifetimeMinor: number };

export function profitSummary(monthly: RevenueStreams, lifetime: RevenueStreams, aiCost: { monthlyMinor: number; lifetimeMinor: number }): ProfitSummary {
  const grossMonthlyMinor = grossMinor(monthly);
  const grossLifetimeMinor = grossMinor(lifetime);
  return {
    grossMonthlyMinor,
    netMonthlyMinor: netAfterAiMinor(grossMonthlyMinor, aiCost.monthlyMinor),
    grossLifetimeMinor,
    netLifetimeMinor: netAfterAiMinor(grossLifetimeMinor, aiCost.lifetimeMinor),
  };
}

/** AI cost in paise from token usage priced per million tokens (prices in paise per 1M tokens). */
export function aiCallCostMinor(inputTokens: number, outputTokens: number, price: { inputPerMillionMinor: number; outputPerMillionMinor: number }): number {
  const micro = inputTokens * price.inputPerMillionMinor + outputTokens * price.outputPerMillionMinor;
  return Math.ceil(micro / 1_000_000);
}

// ---- GMV commission invoices ----------------------------------------------------------------

export type CommissionInvoiceDraft = { tenantId: string; periodStart: string; periodEnd: string; gmvMinor: number; rateBps: number; commissionMinor: number };

/** Month bounds (YYYY-MM-DD, inclusive start, exclusive end) for the calendar month before `today`. */
export function previousMonthPeriod(today: Date): { start: string; end: string } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** One invoice per store with GMV in the period; zero-GMV and zero-rate stores are skipped. */
export function buildCommissionInvoices(
  period: { start: string; end: string },
  stores: readonly { tenantId: string; gmvMinor: number; rateBps: number }[],
): CommissionInvoiceDraft[] {
  return stores
    .filter((s) => s.gmvMinor > 0 && s.rateBps > 0)
    .map((s) => ({ tenantId: s.tenantId, periodStart: period.start, periodEnd: period.end, gmvMinor: s.gmvMinor, rateBps: s.rateBps, commissionMinor: applyBps(s.gmvMinor, s.rateBps) }))
    .filter((d) => d.commissionMinor > 0);
}

export function invoiceNumber(periodStart: string, seq: number): string {
  return `PC-${periodStart.slice(0, 7).replace("-", "")}-${String(seq).padStart(4, "0")}`;
}

// ---- Partner commissions + payouts -----------------------------------------------------------

/** Same tiers and types as the old Pictocart partner programme (and the SQL checks in migration 3800). */
export const PARTNER_TIERS = ["partner", "state_head", "regional_head"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];
export const PARTNER_TYPES = ["agency", "freelancer", "intern", "agent"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Direct commission on a sale by the selling partner, and an override for their upline (parent). */
export function partnerSaleCommissions(
  saleMinor: number,
  seller: { partnerId: string; directBps: number; parentId: string | null },
  parent: { overrideBps: number } | null,
): { partnerId: string; kind: "direct" | "override"; amountMinor: number }[] {
  const out: { partnerId: string; kind: "direct" | "override"; amountMinor: number }[] = [];
  const direct = applyBps(saleMinor, seller.directBps);
  if (direct > 0) out.push({ partnerId: seller.partnerId, kind: "direct", amountMinor: direct });
  if (seller.parentId && parent) {
    const override = applyBps(saleMinor, parent.overrideBps);
    if (override > 0) out.push({ partnerId: seller.parentId, kind: "override", amountMinor: override });
  }
  return out;
}

export type PendingCommission = { id: string; partnerId: string; kind: "direct" | "override"; amountMinor: number; earnedOn: string; status: "pending" | "batched" | "paid" | "void" };

export type PayoutLine = { partnerId: string; count: number; directMinor: number; overrideMinor: number; totalMinor: number; commissionIds: string[] };

/**
 * Groups unpaid commissions earned on or before the cutoff (YYYY-MM-DD, inclusive) into one payout per
 * partner. Partners whose total is below `minPayoutMinor` roll over to the next batch.
 */
export function batchPayouts(commissions: readonly PendingCommission[], cutoff: string, minPayoutMinor = 0): { lines: PayoutLine[]; totalMinor: number; carriedOver: number } {
  const byPartner = new Map<string, PayoutLine>();
  for (const c of commissions) {
    if (c.status !== "pending" || c.earnedOn.slice(0, 10) > cutoff || c.amountMinor <= 0) continue;
    let line = byPartner.get(c.partnerId);
    if (!line) {
      line = { partnerId: c.partnerId, count: 0, directMinor: 0, overrideMinor: 0, totalMinor: 0, commissionIds: [] };
      byPartner.set(c.partnerId, line);
    }
    line.count += 1;
    if (c.kind === "direct") line.directMinor += c.amountMinor;
    else line.overrideMinor += c.amountMinor;
    line.totalMinor += c.amountMinor;
    line.commissionIds.push(c.id);
  }
  const all = [...byPartner.values()];
  const lines = all.filter((l) => l.totalMinor >= Math.max(1, minPayoutMinor)).sort((a, b) => b.totalMinor - a.totalMinor);
  return { lines, totalMinor: lines.reduce((n, l) => n + l.totalMinor, 0), carriedOver: all.length - lines.length };
}

/** Last day of the month containing `date` (YYYY-MM-DD), the default payout cutoff. */
export function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// ---- Partner analytics -----------------------------------------------------------------------

export type RangePreset = "7d" | "30d" | "90d" | "ytd";

/** IST calendar range for a preset, inclusive on both ends. */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const t = Date.parse(`${today}T00:00:00Z`);
  const days = { "7d": 7, "30d": 30, "90d": 90 } as const;
  if (preset === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: new Date(t - days[preset] * 86_400_000).toISOString().slice(0, 10), to: today };
}

export type LeaderboardInput = { partnerId: string; name: string; tier: string; state: string | null; licenses: number; gmvMinor: number; commissionMinor: number };
export type RankBy = "commission" | "gmv" | "licenses";

export function rankPartners(rows: readonly LeaderboardInput[], by: RankBy): LeaderboardInput[] {
  const key = { commission: "commissionMinor", gmv: "gmvMinor", licenses: "licenses" } as const;
  return [...rows].sort((a, b) => b[key[by]] - a[key[by]] || b.gmvMinor - a.gmvMinor || a.name.localeCompare(b.name));
}

// ---- Credits economy ------------------------------------------------------------------------

/**
 * Credit pricing. Costs are in paise with two extra decimals ("centi-paise", 1 ₹ = 10,000) so a
 * base cost like ₹0.03 stays an integer; the margin multiplier is in hundredths (3× = 300).
 */
export type CreditPricing = {
  baseCostCentiPaise: number;
  marginX100: number;
  creditsPerRupee: number;
  customMinMinor: number;
  customMaxMinor: number;
  welcomeCredits: number;
  lowBalance: number;
  criticalBalance: number;
  freelancerHourlyMinor: number;
};

/** Mirrors the seed row of ai_credit_settings (migration 3900). */
export const DEFAULT_CREDIT_PRICING: CreditPricing = {
  baseCostCentiPaise: 300, // ₹0.03
  marginX100: 300,
  creditsPerRupee: 11,
  customMinMinor: 9_900,
  customMaxMinor: 5_000_000,
  welcomeCredits: 100,
  lowBalance: 20,
  criticalBalance: 5,
  freelancerHourlyMinor: 60_000,
};

export function sellPriceCentiPaise(p: Pick<CreditPricing, "baseCostCentiPaise" | "marginX100">): number {
  return Math.round((p.baseCostCentiPaise * p.marginX100) / 100);
}

/** Gross margin on each credit sold, in basis points (3× → 6,667 = 66.67%). */
export function creditGrossMarginBps(p: Pick<CreditPricing, "marginX100">): number {
  if (p.marginX100 <= 0) return 0;
  return Math.round(BPS - (BPS * 100) / p.marginX100);
}

/** Whole credits an amount buys at the sell price (rounded down: never give away a part credit). */
export function creditsForAmount(amountMinor: number, p: Pick<CreditPricing, "baseCostCentiPaise" | "marginX100">): number {
  const price = sellPriceCentiPaise(p);
  if (price <= 0 || amountMinor <= 0) return 0;
  return Math.floor((amountMinor * 100) / price);
}

/** Price in paise (rounded up) for a number of credits at the sell price. */
export function priceForCredits(credits: number, p: Pick<CreditPricing, "baseCostCentiPaise" | "marginX100">): number {
  return Math.ceil((credits * sellPriceCentiPaise(p)) / 100);
}

export type BalanceLevel = "ok" | "low" | "critical" | "empty";

export function balanceLevel(balance: number, p: Pick<CreditPricing, "lowBalance" | "criticalBalance">): BalanceLevel {
  if (balance <= 0) return "empty";
  if (balance <= p.criticalBalance) return "critical";
  if (balance <= p.lowBalance) return "low";
  return "ok";
}

/** Rupee value of time saved: minutes saved × freelancer hourly rate. */
export function savingsMinor(minutesSaved: number, p: Pick<CreditPricing, "freelancerHourlyMinor">): number {
  return Math.round((minutesSaved * p.freelancerHourlyMinor) / 60);
}

/** Validates a pricing document; returns field errors keyed by field name. */
export function validateCreditPricing(p: CreditPricing): Partial<Record<keyof CreditPricing, string>> {
  const e: Partial<Record<keyof CreditPricing, string>> = {};
  if (p.baseCostCentiPaise <= 0) e.baseCostCentiPaise = "Base cost must be above zero.";
  if (p.marginX100 < 100) e.marginX100 = "Margin must be at least 1× (no selling below cost).";
  if (p.creditsPerRupee <= 0) e.creditsPerRupee = "Credits per ₹1 must be above zero.";
  if (p.customMinMinor <= 0) e.customMinMinor = "Minimum must be above zero.";
  if (p.customMaxMinor < p.customMinMinor) e.customMaxMinor = "Maximum must be at least the minimum.";
  if (p.criticalBalance > p.lowBalance) e.criticalBalance = "Critical warning must be at or below the low-balance warning.";
  if (p.welcomeCredits < 0) e.welcomeCredits = "Welcome credits cannot be negative.";
  return e;
}
