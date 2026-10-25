import { describe, expect, it } from "vitest";
import { DEFAULT_CREDIT_PRICING } from "@/features/platform-finance/calc";
import {
  actionCostSchema,
  centiPaiseToRupees,
  customCredits,
  economyTab,
  multiplierToX100,
  packSchema,
  parseInsights,
  pricingFromRow,
  pricingSchema,
  pricingToRow,
  promoBonus,
  promoSchema,
  rupeesToCentiPaise,
  trimDecimal,
  x100ToMultiplier,
} from "@/features/ai-credits/economy-schemas";
import { FALLBACK_PACKS, creditPurchaseSchema } from "@/features/ai-credits/schemas";

const SEED_ROW = { base_cost_per_credit: 0.03, margin_multiplier: 3, custom_credits_per_rupee: 11, custom_min: 99, custom_max: 50000, welcome_credits: 100, low_balance: 20, critical_balance: 5, freelancer_hourly: 600 };
const FORM = { baseCost: "0.03", margin: "3", creditsPerRupee: "11", customMin: "99", customMax: "50000", welcomeCredits: "100", lowBalance: "20", criticalBalance: "5", freelancerHourly: "600" };

describe("credit pricing conversions", () => {
  it("rupees ↔ centi-paise and multiplier ↔ ×100 without float drift", () => {
    expect(rupeesToCentiPaise("0.03")).toBe(300);
    expect(rupeesToCentiPaise("0.0125")).toBe(125);
    expect(rupeesToCentiPaise(0.03)).toBe(300);
    expect(rupeesToCentiPaise("12")).toBe(120_000);
    expect(() => rupeesToCentiPaise("0.00001")).toThrow();
    expect(centiPaiseToRupees(300)).toBe("0.0300");
    expect(trimDecimal(centiPaiseToRupees(300))).toBe("0.03");
    expect(multiplierToX100("2.5")).toBe(250);
    expect(multiplierToX100(3)).toBe(300);
    expect(x100ToMultiplier(250)).toBe("2.50");
    expect(trimDecimal("3.00")).toBe("3");
  });

  it("the seed row maps to DEFAULT_CREDIT_PRICING and back", () => {
    expect(pricingFromRow(SEED_ROW)).toEqual(DEFAULT_CREDIT_PRICING);
    expect(pricingFromRow({ ...SEED_ROW, base_cost_per_credit: "0.0300", margin_multiplier: "3.00", custom_min: "99.00" })).toEqual(DEFAULT_CREDIT_PRICING);
    expect(pricingFromRow(null)).toEqual(DEFAULT_CREDIT_PRICING);
    expect(pricingToRow(DEFAULT_CREDIT_PRICING)).toEqual(SEED_ROW);
  });

  it("custom amounts and promo bonuses round down like the SQL", () => {
    expect(customCredits(10_000, 11)).toBe(1100);
    expect(customCredits(9_950, 11)).toBe(1094);
    expect(customCredits(0, 11)).toBe(0);
    expect(promoBonus(500, 20)).toBe(100);
    expect(promoBonus(1094, 15)).toBe(164);
  });
});

describe("pricing form", () => {
  it("parses the seed values into CreditPricing", () => {
    expect(pricingSchema.parse(FORM)).toEqual(DEFAULT_CREDIT_PRICING);
  });

  it("reports calc.validateCreditPricing errors on the form fields", () => {
    const r = pricingSchema.safeParse({ ...FORM, margin: "0.5", criticalBalance: "30", customMax: "10" });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["margin", "criticalBalance", "customMax"]));
    expect(pricingSchema.safeParse({ ...FORM, baseCost: "0" }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...FORM, margin: "101" }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...FORM, welcomeCredits: "-1" }).success).toBe(false);
  });
});

describe("packs, promos and actions", () => {
  it("validates packs (lowercase code, not 'custom', price in paise)", () => {
    expect(packSchema.parse({ code: "Festive", label: "Festive", credits: "800", price: "649.50", active: "on" })).toEqual({ code: "festive", label: "Festive", credits: 800, price: 64_950, active: true, sortOrder: 0 });
    expect(packSchema.safeParse({ code: "custom", label: "Custom", credits: "1", price: "1" }).success).toBe(false);
    expect(packSchema.safeParse({ code: "x", label: "Tiny", credits: "1", price: "1" }).success).toBe(false);
    expect(packSchema.safeParse({ code: "zero", label: "Zero", credits: "1", price: "0" }).success).toBe(false);
  });

  it("upper-cases promo codes and checks dates and limits", () => {
    expect(promoSchema.parse({ code: " diwali25 ", bonusPct: "20" })).toEqual({ code: "DIWALI25", bonusPct: 20, startsAt: undefined, endsAt: undefined, maxUses: undefined });
    expect(promoSchema.safeParse({ code: "AB", bonusPct: "20" }).success).toBe(false);
    expect(promoSchema.safeParse({ code: "OK1", bonusPct: "501" }).success).toBe(false);
    expect(promoSchema.safeParse({ code: "OK1", bonusPct: "10", startsAt: "2026-11-02", endsAt: "2026-11-01" }).success).toBe(false);
    expect(promoSchema.safeParse({ code: "OK1", bonusPct: "10", maxUses: "0" }).success).toBe(false);
  });

  it("limits action costs to the SQL ranges", () => {
    expect(actionCostSchema.parse({ kind: "caption", label: "Social caption", credits: "2", minutesSaved: "10" })).toEqual({ kind: "caption", label: "Social caption", credits: 2, minutesSaved: 10 });
    expect(actionCostSchema.safeParse({ kind: "caption", label: "Caption", credits: "0", minutesSaved: "1" }).success).toBe(false);
    expect(actionCostSchema.safeParse({ kind: "Caption!", label: "Caption", credits: "1", minutesSaved: "1" }).success).toBe(false);
  });

  it("parses insights jsonb defensively", () => {
    const i = parseInsights({ accounts: 2, balance: 150, granted: 200, purchased: "500", used: 50, revenue: 399, lowBalance: 1, criticalBalance: 0, byKind: [{ kind: "caption", uses: 3, credits: 6, minutesSaved: 30 }], topStores: [{ tenantId: "t", name: "Aangan", credits: 6 }] });
    expect(i.revenueMinor).toBe(39_900);
    expect(i.purchased).toBe(500);
    expect(i.byKind[0]).toEqual({ kind: "caption", uses: 3, credits: 6, minutesSaved: 30 });
    expect(parseInsights(null).byKind).toEqual([]);
    expect(economyTab("promos")).toBe("promos");
    expect(economyTab("nope")).toBe("pricing");
  });
});

describe("seller purchase schema", () => {
  it("accepts any pack code, upper-cases promo, ignores amount unless custom", () => {
    expect(creditPurchaseSchema.parse({ pack: "growth", method: "offline", promo: "diwali25", amount: "500" })).toEqual({ pack: "growth", method: "offline", promo: "DIWALI25", amount: undefined });
    expect(creditPurchaseSchema.parse({ pack: "custom", method: "online", amount: "249.50" })).toEqual({ pack: "custom", method: "online", promo: undefined, amount: 24_950 });
  });

  it("requires an amount for custom and rejects bad codes", () => {
    expect(creditPurchaseSchema.safeParse({ pack: "custom", method: "online" }).success).toBe(false);
    expect(creditPurchaseSchema.safeParse({ pack: "custom", method: "online", amount: "abc" }).success).toBe(false);
    expect(creditPurchaseSchema.safeParse({ pack: "growth", method: "online", promo: "x" }).success).toBe(false);
    expect(creditPurchaseSchema.safeParse({ pack: "Growth!", method: "online" }).success).toBe(false);
    expect(creditPurchaseSchema.safeParse({ pack: "growth", method: "cash" }).success).toBe(false);
  });

  it("keeps the fallback packs equal to the migration 3900 seed", () => {
    expect(FALLBACK_PACKS.map((p) => [p.code, p.credits, p.priceMinor])).toEqual([
      ["starter", 100, 9_900],
      ["growth", 500, 39_900],
      ["pro", 1500, 99_900],
    ]);
  });
});
