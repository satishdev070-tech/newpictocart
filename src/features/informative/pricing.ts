import { formatMoney } from "@/lib/money";

/** How a service price is shown (stored in info_services.price_type). */
export const PRICE_TYPES = ["FIXED", "STARTING_FROM", "ON_REQUEST", "HIDDEN"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  FIXED: "Fixed price",
  STARTING_FROM: "Starting from",
  ON_REQUEST: "Price on request",
  HIDDEN: "Don't show a price",
};

/** Whether the type needs an amount. */
export const priceTypeNeedsAmount = (t: PriceType): boolean => t === "FIXED" || t === "STARTING_FROM";

/**
 * Public price text for a service (pure). Amounts are integer paise (ADR-008).
 * HIDDEN → null (render nothing). A missing amount on a priced type degrades to "on request".
 */
export function formatServicePrice(type: PriceType, pricePaise: number | null | undefined): string | null {
  if (type === "HIDDEN") return null;
  if (type === "ON_REQUEST" || pricePaise == null) return "Price on request";
  const amount = formatMoney(pricePaise);
  return type === "STARTING_FROM" ? `From ${amount}` : amount;
}

/** "45 min", "1 hr", "1 hr 30 min" (pure). */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
