import { formatMoney } from "@/lib/money";
import { priceCart, type DiscountDefinition, type PricingInput } from "./pricing";

/**
 * Storefront "View offers" (pure). The seller marks coupon codes as public (`show_in_offers`);
 * these helpers decide which of them to show for a cart or a product and what each would save.
 * Display only: applying a code still goes through the server action, and the order total is
 * re-priced on the server (`quoteCart`) with whatever code the cart holds.
 */
export type OfferView = {
  code: string;
  title: string | null;
  /** e.g. "10% off · up to ₹500 · min order ₹999" */
  summary: string;
  /** paise */
  minSubtotal: number;
  /** applicable now, or locked until the bag reaches `minSubtotal` */
  status: "applicable" | "min_subtotal";
  /** paise the shopper saves on this bag (0 when not yet applicable / shipping unknown) */
  savings: number;
  freeShipping: boolean;
  /** paise still to add to unlock (0 when applicable) */
  shortfall: number;
  applied: boolean;
};

/** Short human description of a discount (amounts in paise). */
export function describeOffer(d: Pick<DiscountDefinition, "type" | "value" | "minSubtotal" | "maxDiscount" | "buyQuantity" | "getQuantity" | "getPercent">): string {
  const parts: string[] = [];
  if (d.type === "percentage") parts.push(`${d.value}% off`);
  else if (d.type === "fixed_amount") parts.push(`${formatMoney(d.value)} off`);
  else if (d.type === "free_shipping") parts.push("Free shipping");
  else {
    const pct = d.getPercent ?? 100;
    parts.push(`Buy ${d.buyQuantity ?? 1} get ${d.getQuantity ?? 1} ${pct >= 100 ? "free" : `at ${pct}% off`}`);
  }
  if (d.maxDiscount !== null && d.type !== "fixed_amount" && d.type !== "free_shipping") parts.push(`up to ${formatMoney(d.maxDiscount)}`);
  if (d.minSubtotal > 0) parts.push(`min order ${formatMoney(d.minSubtotal)}`);
  return parts.join(" · ");
}

/** Does the discount target this product (directly, through one of its collections, or store-wide)? */
export function offerTargetsProduct(d: Pick<DiscountDefinition, "appliesTo" | "productIds" | "collectionIds">, productId: string, collectionIds: readonly string[] = []): boolean {
  if (d.appliesTo === "all") return true;
  if (d.appliesTo === "products") return (d.productIds ?? []).includes(productId);
  const wanted = new Set(d.collectionIds ?? []);
  return collectionIds.some((c) => wanted.has(c));
}

/**
 * Offers worth showing for a bag: codes that apply now (best saving first), then codes that
 * only need a bigger bag (smallest shortfall first). Codes that target nothing in the bag are
 * left out. `base` is the same pricing input the server quote uses, minus the discount.
 */
export function evaluateOffers(base: Omit<PricingInput, "discount">, offers: readonly DiscountDefinition[], appliedCode: string | null): OfferView[] {
  if (base.lines.length === 0) return [];
  const baseline = priceCart(base);
  const out: OfferView[] = [];
  for (const d of offers) {
    if (!d.code) continue;
    if (!base.lines.some((l) => offerTargetsProduct(d, l.productId, l.collectionIds))) continue;
    const attempt = priceCart({ ...base, discount: d });
    const view = { code: d.code, title: d.title ?? null, summary: describeOffer(d), minSubtotal: d.minSubtotal, freeShipping: d.type === "free_shipping", applied: d.code === appliedCode };
    if (attempt.discount.status === "applied") {
      out.push({ ...view, status: "applicable", savings: Math.max(0, baseline.grandTotal - attempt.grandTotal), shortfall: 0 });
    } else if (attempt.discount.status === "rejected" && attempt.discount.reason === "min_subtotal") {
      out.push({ ...view, status: "min_subtotal", savings: 0, shortfall: d.minSubtotal - baseline.subtotal });
    }
  }
  return out.sort((a, b) =>
    a.status !== b.status ? (a.status === "applicable" ? -1 : 1) : a.status === "applicable" ? b.savings - a.savings : a.shortfall - b.shortfall,
  );
}
