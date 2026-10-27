import { describe, expect, it } from "vitest";
import { describeOffer, evaluateOffers, offerTargetsProduct } from "@/features/checkout/offers";
import type { DiscountDefinition, PricingInput } from "@/features/checkout/pricing";

const base = (lines: PricingInput["lines"]): Omit<PricingInput, "discount"> => ({
  lines,
  shippingRates: [
    { id: "std", name: "Standard", price: 9_900, minSubtotal: 0, maxSubtotal: 149_999, minWeightGrams: 0, maxWeightGrams: null, pincodePrefixes: [], estimatedDaysMin: 3, estimatedDaysMax: 6, codAllowed: true },
  ],
  pincode: "302001",
  cod: { enabled: true, fee: 0, minOrder: 0, maxOrder: null },
  tax: { pricesIncludeTax: true, rules: [{ rate: 5 }] },
});

const line = (productId: string, unitPrice: number, quantity = 1, collectionIds: string[] = []) => ({ key: `v-${productId}`, productId, collectionIds, unitPrice, quantity });

const d = (over: Partial<DiscountDefinition>): DiscountDefinition => ({
  id: over.code ?? "d",
  code: "CODE",
  type: "percentage",
  value: 10,
  appliesTo: "all",
  minSubtotal: 0,
  maxDiscount: null,
  ...over,
});

describe("coupon eligibility (View offers)", () => {
  const welcome = d({ code: "WELCOME10", title: "10% off", value: 10, minSubtotal: 99_900, maxDiscount: 50_000 });
  const flat = d({ code: "FLAT300", type: "fixed_amount", value: 30_000, minSubtotal: 299_900 });
  const shoes = d({ code: "SHOES15", value: 15, appliesTo: "products", productIds: ["shoe"] });
  const ship = d({ code: "FREESHIP", type: "free_shipping", value: 0 });

  it("lists applicable codes first with the saving, then locked codes with the shortfall", () => {
    const offers = evaluateOffers(base([line("kurta", 120_000)]), [flat, welcome, shoes], null);
    expect(offers.map((o) => [o.code, o.status])).toEqual([
      ["WELCOME10", "applicable"],
      ["FLAT300", "min_subtotal"],
    ]);
    expect(offers[0]!.savings).toBe(12_000);
    expect(offers[1]!.shortfall).toBe(299_900 - 120_000);
  });

  it("hides codes that target nothing in the bag and shows product codes when the product is there", () => {
    expect(evaluateOffers(base([line("kurta", 50_000)]), [shoes], null)).toEqual([]);
    const [o] = evaluateOffers(base([line("kurta", 50_000), line("shoe", 200_000)]), [shoes], null);
    expect(o).toMatchObject({ code: "SHOES15", status: "applicable", savings: 30_000 });
  });

  it("sorts applicable offers by saving and caps percentage savings at max_discount", () => {
    const offers = evaluateOffers(base([line("kurta", 800_000)]), [welcome, flat], null);
    expect(offers.map((o) => [o.code, o.savings])).toEqual([
      ["WELCOME10", 50_000],
      ["FLAT300", 30_000],
    ]);
  });

  it("values free shipping by the shipping it removes and marks the applied code", () => {
    const [o] = evaluateOffers(base([line("kurta", 50_000)]), [ship], "FREESHIP");
    expect(o).toMatchObject({ status: "applicable", freeShipping: true, savings: 9_900, applied: true });
  });

  it("ignores automatic discounts (no code) and empty bags", () => {
    expect(evaluateOffers(base([line("kurta", 50_000)]), [d({ code: null })], null)).toEqual([]);
    expect(evaluateOffers(base([]), [welcome], null)).toEqual([]);
  });

  it("matches a product directly, through a collection, or store-wide", () => {
    expect(offerTargetsProduct(d({ appliesTo: "all" }), "p1")).toBe(true);
    expect(offerTargetsProduct(d({ appliesTo: "products", productIds: ["p1"] }), "p1")).toBe(true);
    expect(offerTargetsProduct(d({ appliesTo: "products", productIds: ["p2"] }), "p1")).toBe(false);
    expect(offerTargetsProduct(d({ appliesTo: "collections", collectionIds: ["c1"] }), "p1", ["c1", "c9"])).toBe(true);
    expect(offerTargetsProduct(d({ appliesTo: "collections", collectionIds: ["c1"] }), "p1", ["c2"])).toBe(false);
  });

  it("describes offers for shoppers", () => {
    expect(describeOffer(welcome)).toBe("10% off · up to ₹500 · min order ₹999");
    expect(describeOffer(flat)).toBe("₹300 off · min order ₹2,999");
    expect(describeOffer(ship)).toBe("Free shipping");
    expect(describeOffer(d({ type: "buy_x_get_y", buyQuantity: 2, getQuantity: 1, getPercent: 100 }))).toBe("Buy 2 get 1 free");
  });
});
