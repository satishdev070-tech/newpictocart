import { z } from "zod";
import { pagination } from "@/lib/validation/common";
import { applyBps, previousMonthPeriod } from "./calc";

/** Zod schemas + pure helpers for the Revenue and Commissions Super Admin pages. */

export const INVOICE_FILTER_STATUSES = ["pending", "paid", "waived", "overdue"] as const;
export type InvoiceFilterStatus = (typeof INVOICE_FILTER_STATUSES)[number];
export type InvoiceStatus = "pending" | "paid" | "waived";
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";

export const commissionListFilterSchema = pagination.extend({
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .catch(undefined)
    .transform((v) => v || undefined),
  status: z.enum(INVOICE_FILTER_STATUSES).optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).catch(25),
});
export type CommissionListFilter = z.infer<typeof commissionListFilterSchema>;

/** "YYYY-MM" from <input type="month"> → first day of that month. */
export const generateInvoicesSchema = z.object({
  period: z
    .string({ error: "Choose a month" })
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month")
    .transform((v) => `${v}-01`),
});

export const markInvoicePaidSchema = z.object({
  invoiceId: z.uuid(),
  reference: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(160, "Keep the reference under 160 characters").optional()),
});

export const waiveInvoiceSchema = z.object({
  invoiceId: z.uuid(),
  reason: z.string({ error: "A reason is required" }).trim().min(3, "Give a reason of at least 3 characters").max(500),
});

/** A GMV commission rate typed as a percentage ("2", "1.5", "0.25") → integer basis points. */
export const commissionPercentField = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 2 or 1.5")
    .transform((v) => {
      const [whole, frac = ""] = v.split(".");
      return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    })
    .refine((bps) => bps <= 10_000, "Can't be more than 100%")
    .optional(),
);

/** Basis points → the value shown in the plan form's percentage input ("2", "1.5", "0.25"). */
export function bpsToPercentInput(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Today's IST calendar date (YYYY-MM-DD). */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Default month for "Run invoice generation" (YYYY-MM): the IST calendar month before today. */
export function defaultInvoiceMonth(now: Date = new Date()): string {
  return previousMonthPeriod(new Date(`${istToday(now)}T00:00:00Z`)).start.slice(0, 7);
}

/** Pending invoices past their due date (IST) are shown and filtered as overdue. */
export function invoiceDisplayStatus(status: string, dueDate: string, today: string): InvoiceDisplayStatus {
  if (status === "paid" || status === "waived") return status;
  return dueDate < today ? "overdue" : "pending";
}

export type InvoiceTotalsInput = { status: string; dueDate: string; gmvMinor: number; commissionMinor: number };
export type InvoiceTotals = { count: number; gmvMinor: number; commissionMinor: number; collectedMinor: number; outstandingMinor: number; overdueMinor: number; waivedMinor: number };

export function invoiceTotals(rows: readonly InvoiceTotalsInput[], today: string): InvoiceTotals {
  const t: InvoiceTotals = { count: 0, gmvMinor: 0, commissionMinor: 0, collectedMinor: 0, outstandingMinor: 0, overdueMinor: 0, waivedMinor: 0 };
  for (const r of rows) {
    t.count += 1;
    t.gmvMinor += r.gmvMinor;
    t.commissionMinor += r.commissionMinor;
    const s = invoiceDisplayStatus(r.status, r.dueDate, today);
    if (s === "paid") t.collectedMinor += r.commissionMinor;
    else if (s === "waived") t.waivedMinor += r.commissionMinor;
    else {
      t.outstandingMinor += r.commissionMinor;
      if (s === "overdue") t.overdueMinor += r.commissionMinor;
    }
  }
  return t;
}

/** Commission on per-store GMV at each store's current plan rate (stores without a rate earn nothing). */
export function commissionOnGmv(gmv: readonly { tenantId: string; gmvMinor: number }[], rateByTenant: ReadonlyMap<string, number>): { gmvMinor: number; commissionMinor: number } {
  let gmvMinor = 0;
  let commissionMinor = 0;
  for (const g of gmv) {
    gmvMinor += g.gmvMinor;
    commissionMinor += applyBps(g.gmvMinor, rateByTenant.get(g.tenantId) ?? 0);
  }
  return { gmvMinor, commissionMinor };
}

export type ThemeAdoptionRow = { themeKey: string; label: string; stores: number };

/** Stores per published theme (one published theme per store; the most common label names the theme). */
export function themeAdoption(published: readonly { tenantId: string; themeKey: string; label: string | null }[]): ThemeAdoptionRow[] {
  const byKey = new Map<string, { tenants: Set<string>; labels: Map<string, number> }>();
  for (const p of published) {
    let e = byKey.get(p.themeKey);
    if (!e) {
      e = { tenants: new Set(), labels: new Map() };
      byKey.set(p.themeKey, e);
    }
    e.tenants.add(p.tenantId);
    const label = p.label?.trim();
    if (label) e.labels.set(label, (e.labels.get(label) ?? 0) + 1);
  }
  return [...byKey.entries()]
    .map(([themeKey, e]) => {
      const top = [...e.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return { themeKey, label: top?.[0] ?? themeKey, stores: e.tenants.size };
    })
    .sort((a, b) => b.stores - a.stores || a.label.localeCompare(b.label));
}

export type ModelUsage = { provider: string; model: string; calls: number; tokens: number };
export type ModelCostRow = ModelUsage & { pricePerMillionMinor: number | null; costMinor: number };

/** AI cost per provider+model; models without a price are kept with `pricePerMillionMinor: null` ("unpriced"). */
export function aiCostByModel(
  usage: readonly ModelUsage[],
  prices: ReadonlyMap<string, number>,
  costOf: (tokens: number, pricePerMillionMinor: number) => number,
): { rows: ModelCostRow[]; totalMinor: number; unpriced: ModelCostRow[] } {
  const rows = usage.map((u) => {
    const price = prices.get(modelKey(u.provider, u.model));
    return { ...u, pricePerMillionMinor: price ?? null, costMinor: price === undefined ? 0 : costOf(u.tokens, price) };
  });
  rows.sort((a, b) => b.costMinor - a.costMinor || b.tokens - a.tokens);
  return { rows, totalMinor: rows.reduce((n, r) => n + r.costMinor, 0), unpriced: rows.filter((r) => r.pricePerMillionMinor === null && r.tokens > 0) };
}

export const modelKey = (provider: string, model: string) => `${provider}\u0000${model}`;
