import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREDIT_PRICING,
  aiCallCostMinor,
  applyBps,
  balanceLevel,
  batchPayouts,
  bpsToPercentLabel,
  buildCommissionInvoices,
  creditGrossMarginBps,
  creditsForAmount,
  invoiceNumber,
  marginBps,
  monthEnd,
  netAfterAiMinor,
  partnerSaleCommissions,
  percentToBps,
  presetRange,
  previousMonthPeriod,
  priceForCredits,
  profitSummary,
  rankPartners,
  savingsMinor,
  sellPriceCentiPaise,
  storeMrrMinor,
  subscriptionBreakdown,
  validateCreditPricing,
  type PendingCommission,
} from "@/features/platform-finance/calc";

const plans = [
  { id: "free", name: "Free", priceMonthlyMinor: 0, priceYearlyMinor: 0, commissionBps: 300 },
  { id: "starter", name: "Starter", priceMonthlyMinor: 99_900, priceYearlyMinor: 999_000, commissionBps: 200 },
  { id: "growth", name: "Growth", priceMonthlyMinor: 199_900, priceYearlyMinor: 1_999_000, commissionBps: 100 },
];

describe("bps maths", () => {
  it("rounds half up to the paisa and keeps integers", () => {
    expect(applyBps(10_000, 300)).toBe(300);
    expect(applyBps(8_500_000, 200)).toBe(170_000);
    expect(applyBps(1, 5000)).toBe(1); // 0.5 paise rounds up
    expect(applyBps(1, 4999)).toBe(0);
    expect(applyBps(-1_000, 1000)).toBe(-100);
    expect(() => applyBps(1.5, 100)).toThrow(RangeError);
    expect(() => applyBps(100, 10_001)).toThrow(RangeError);
  });
  it("converts percents", () => {
    expect(percentToBps(2)).toBe(200);
    expect(percentToBps(1.5)).toBe(150);
    expect(bpsToPercentLabel(300)).toBe("3%");
    expect(bpsToPercentLabel(150)).toBe("1.5%");
    expect(() => percentToBps(101)).toThrow();
  });
});

describe("MRR", () => {
  it("counts only active paying stores; yearly as a twelfth", () => {
    expect(storeMrrMinor({ planId: "s", status: "active", priceMonthlyMinor: 99_900, priceYearlyMinor: 999_000 })).toBe(99_900);
    expect(storeMrrMinor({ planId: "s", status: "active", priceMonthlyMinor: 99_900, priceYearlyMinor: 999_000, cycle: "yearly" })).toBe(83_250);
    expect(storeMrrMinor({ planId: "s", status: "trial", priceMonthlyMinor: 99_900, priceYearlyMinor: 0 })).toBe(0);
    expect(storeMrrMinor({ planId: "s", status: "suspended", priceMonthlyMinor: 99_900, priceYearlyMinor: 0 })).toBe(0);
  });

  it("matches the old Revenue P&L screen (51 free, 4 starter, 10 growth → ₹23,986)", () => {
    const stores = [
      ...Array.from({ length: 51 }, () => ({ planId: "free", status: "active" })),
      ...Array.from({ length: 4 }, () => ({ planId: "starter", status: "active" })),
      ...Array.from({ length: 10 }, () => ({ planId: "growth", status: "active" })),
      { planId: "growth", status: "cancelled" },
    ];
    const b = subscriptionBreakdown(plans, stores);
    expect(b.mrrMinor).toBe(2_398_600);
    expect(b.paying).toBe(14);
    expect(b.trial).toBe(0);
    expect(b.total).toBe(65);
    expect(b.rows.map((r) => [r.planName, r.stores, r.mrrMinor])).toEqual([
      ["Free", 51, 0],
      ["Starter", 4, 399_600],
      ["Growth", 10, 1_999_000],
    ]);
  });

  it("puts trials and unknown plans in their own buckets", () => {
    const b = subscriptionBreakdown(plans, [
      { planId: "growth", status: "trial" },
      { planId: null, status: "active" },
    ]);
    expect(b.mrrMinor).toBe(0);
    expect(b.trial).toBe(1);
    expect(b.rows.at(-1)).toMatchObject({ planName: "No plan", stores: 1 });
  });
});

describe("net after AI", () => {
  it("subtracts AI cost and may go negative", () => {
    expect(netAfterAiMinor(2_398_600, 0)).toBe(2_398_600);
    expect(netAfterAiMinor(1_000, 2_500)).toBe(-1_500);
    expect(netAfterAiMinor(1_000, -50)).toBe(1_000);
    expect(marginBps(7_500, 10_000)).toBe(7_500);
    expect(marginBps(1, 0)).toBe(0);
  });
  it("sums all streams", () => {
    const s = profitSummary(
      { subscriptionsMinor: 2_398_600, commissionMinor: 0, creditPacksMinor: 0, themeSalesMinor: 0 },
      { subscriptionsMinor: 2_428_800, commissionMinor: 0, creditPacksMinor: 20_700, themeSalesMinor: 0 },
      { monthlyMinor: 0, lifetimeMinor: 0 },
    );
    expect(s).toEqual({ grossMonthlyMinor: 2_398_600, netMonthlyMinor: 2_398_600, grossLifetimeMinor: 2_449_500, netLifetimeMinor: 2_449_500 });
  });
  it("prices AI calls per million tokens, rounding up", () => {
    expect(aiCallCostMinor(1_000_000, 0, { inputPerMillionMinor: 2_500, outputPerMillionMinor: 10_000 })).toBe(2_500);
    expect(aiCallCostMinor(1, 1, { inputPerMillionMinor: 2_500, outputPerMillionMinor: 10_000 })).toBe(1);
    expect(aiCallCostMinor(0, 0, { inputPerMillionMinor: 2_500, outputPerMillionMinor: 10_000 })).toBe(0);
  });
});

describe("commission invoices", () => {
  it("bills the previous month per store", () => {
    expect(previousMonthPeriod(new Date("2026-10-25T10:00:00Z"))).toEqual({ start: "2026-09-01", end: "2026-10-01" });
    expect(previousMonthPeriod(new Date("2026-01-03T00:00:00Z"))).toEqual({ start: "2025-12-01", end: "2026-01-01" });
    const drafts = buildCommissionInvoices({ start: "2026-09-01", end: "2026-10-01" }, [
      { tenantId: "a", gmvMinor: 1_000_000, rateBps: 300 },
      { tenantId: "b", gmvMinor: 0, rateBps: 300 },
      { tenantId: "c", gmvMinor: 5_000, rateBps: 0 },
      { tenantId: "d", gmvMinor: 333, rateBps: 100 },
    ]);
    expect(drafts.map((d) => [d.tenantId, d.commissionMinor])).toEqual([
      ["a", 30_000],
      ["d", 3],
    ]);
    expect(invoiceNumber("2026-09-01", 7)).toBe("PC-202609-0007");
  });
});

describe("partner commissions", () => {
  it("pays the seller a direct cut and the upline an override", () => {
    expect(partnerSaleCommissions(8_500_00, { partnerId: "p", directBps: 2000, parentId: "agency" }, { overrideBps: 500 })).toEqual([
      { partnerId: "p", kind: "direct", amountMinor: 170_000 },
      { partnerId: "agency", kind: "override", amountMinor: 42_500 },
    ]);
    expect(partnerSaleCommissions(10_000, { partnerId: "p", directBps: 1000, parentId: null }, null)).toEqual([{ partnerId: "p", kind: "direct", amountMinor: 1_000 }]);
    expect(partnerSaleCommissions(10_000, { partnerId: "p", directBps: 0, parentId: "x" }, { overrideBps: 0 })).toEqual([]);
  });
});

describe("payout batching", () => {
  const c = (id: string, partnerId: string, kind: "direct" | "override", amountMinor: number, earnedOn: string, status: PendingCommission["status"] = "pending"): PendingCommission => ({ id, partnerId, kind, amountMinor, earnedOn, status });
  it("groups pending commissions up to the cutoff per partner", () => {
    const r = batchPayouts(
      [
        c("1", "a", "direct", 10_000, "2026-09-02"),
        c("2", "a", "override", 2_500, "2026-09-30T23:00:00Z"),
        c("3", "a", "direct", 9_999, "2026-10-01"), // after cutoff
        c("4", "b", "direct", 50_000, "2026-08-15"),
        c("5", "b", "direct", 7_000, "2026-08-16", "paid"),
        c("6", "c", "direct", 100, "2026-09-01"),
      ],
      "2026-09-30",
      500,
    );
    expect(r.lines).toEqual([
      { partnerId: "b", count: 1, directMinor: 50_000, overrideMinor: 0, totalMinor: 50_000, commissionIds: ["4"] },
      { partnerId: "a", count: 2, directMinor: 10_000, overrideMinor: 2_500, totalMinor: 12_500, commissionIds: ["1", "2"] },
    ]);
    expect(r.totalMinor).toBe(62_500);
    expect(r.carriedOver).toBe(1);
  });
  it("returns nothing when nothing is owed", () => {
    expect(batchPayouts([], "2026-09-30")).toEqual({ lines: [], totalMinor: 0, carriedOver: 0 });
  });
  it("finds the month end", () => {
    expect(monthEnd("2026-09-12")).toBe("2026-09-30");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("partner analytics", () => {
  it("builds preset ranges", () => {
    expect(presetRange("30d", "2026-10-25")).toEqual({ from: "2026-09-25", to: "2026-10-25" });
    expect(presetRange("7d", "2026-10-25")).toEqual({ from: "2026-10-18", to: "2026-10-25" });
    expect(presetRange("ytd", "2026-10-25")).toEqual({ from: "2026-01-01", to: "2026-10-25" });
  });
  it("ranks by the chosen metric", () => {
    const rows = [
      { partnerId: "1", name: "A", tier: "partner", state: null, licenses: 10, gmvMinor: 100, commissionMinor: 5 },
      { partnerId: "2", name: "B", tier: "partner", state: null, licenses: 2, gmvMinor: 900, commissionMinor: 50 },
    ];
    expect(rankPartners(rows, "licenses").map((r) => r.name)).toEqual(["A", "B"]);
    expect(rankPartners(rows, "gmv").map((r) => r.name)).toEqual(["B", "A"]);
  });
});

describe("credit pricing", () => {
  const p = DEFAULT_CREDIT_PRICING;
  it("matches the old Credits Economy screen (₹0.03 × 3 → ₹0.09, ~67%, ₹100 → 1,111 credits)", () => {
    expect(sellPriceCentiPaise(p)).toBe(900);
    expect(creditGrossMarginBps(p)).toBe(6_667);
    expect(creditsForAmount(10_000, p)).toBe(1_111);
    expect(priceForCredits(1_111, p)).toBe(9_999);
    expect(priceForCredits(1, p)).toBe(9);
  });
  it("classifies balances and savings", () => {
    expect(balanceLevel(0, p)).toBe("empty");
    expect(balanceLevel(5, p)).toBe("critical");
    expect(balanceLevel(20, p)).toBe("low");
    expect(balanceLevel(21, p)).toBe("ok");
    expect(savingsMinor(30, p)).toBe(30_000);
  });
  it("validates the pricing form", () => {
    expect(validateCreditPricing(p)).toEqual({});
    const bad = validateCreditPricing({ ...p, marginX100: 90, customMaxMinor: 100, criticalBalance: 50 });
    expect(Object.keys(bad).sort()).toEqual(["criticalBalance", "customMaxMinor", "marginX100"]);
  });
});
