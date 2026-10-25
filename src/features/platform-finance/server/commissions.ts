import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { toMinor } from "@/lib/money";
import { isMissingSchemaError, sanitizeSearchTerm } from "@/features/platform/schemas";
import { invoiceDisplayStatus, invoiceTotals, istToday, type CommissionListFilter, type InvoiceDisplayStatus, type InvoiceTotals } from "../schemas";

/** Commission invoice reads for /admin/commissions (RLS: platform.finance.read). */

export type CommissionInvoiceRow = {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  storeName: string | null;
  storeSlug: string | null;
  periodStart: string;
  periodEnd: string;
  gmvMinor: number;
  rateBps: number;
  commissionMinor: number;
  status: InvoiceDisplayStatus;
  dueDate: string;
  paidAt: string | null;
  paymentReference: string | null;
  waiveReason: string | null;
};

export type CommissionList = { ready: false } | { ready: true; rows: CommissionInvoiceRow[]; total: number; totals: InvoiceTotals; today: string };

const PAGE = 1000;
const MAX_ROWS = 50_000;

export async function listCommissionInvoices(f: CommissionListFilter, now: Date = new Date()): Promise<CommissionList> {
  const db = await createSupabaseServerClient();
  const today = istToday(now);

  // Totals across every invoice (unfiltered), in pages of 1,000.
  const all: { status: string; due_date: string; gmv: number; commission: number }[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db.from("commission_invoices").select("status, due_date, gmv, commission").order("id").range(from, from + PAGE - 1);
    if (error) {
      if (isMissingSchemaError(error)) return { ready: false };
      throw mapDbError(error);
    }
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const totals = invoiceTotals(
    all.map((r) => ({ status: r.status, dueDate: r.due_date, gmvMinor: toMinor(String(r.gmv)), commissionMinor: toMinor(String(r.commission)) })),
    today,
  );

  let query = db
    .from("commission_invoices")
    .select("id, invoice_number, tenant_id, period_start, period_end, gmv, rate_bps, commission, status, due_date, paid_at, payment_reference, waive_reason, tenants(name, slug)", { count: "exact" });

  const q = sanitizeSearchTerm(f.q);
  if (q) {
    // Store names are matched first (capped), then OR-ed with the invoice number.
    const { data: stores, error } = await db.from("tenants").select("id").or(`name.ilike.*${q}*,slug.ilike.*${q}*`).limit(200);
    if (error) throw mapDbError(error);
    const ids = (stores ?? []).map((s) => s.id);
    query = query.or([`invoice_number.ilike.*${q}*`, ...(ids.length ? [`tenant_id.in.(${ids.join(",")})`] : [])].join(","));
  }
  if (f.status === "overdue") query = query.eq("status", "pending").lt("due_date", today);
  else if (f.status === "pending") query = query.eq("status", "pending").gte("due_date", today);
  else if (f.status) query = query.eq("status", f.status);

  const from = (f.page - 1) * f.pageSize;
  const { data, error, count } = await query
    .order("period_start", { ascending: false })
    .order("invoice_number", { ascending: false })
    .range(from, from + f.pageSize - 1);
  if (error) throw mapDbError(error);

  const rows: CommissionInvoiceRow[] = (data ?? []).map((r) => {
    const store = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      tenantId: r.tenant_id,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      gmvMinor: toMinor(String(r.gmv)),
      rateBps: r.rate_bps,
      commissionMinor: toMinor(String(r.commission)),
      status: invoiceDisplayStatus(r.status, r.due_date, today),
      dueDate: r.due_date,
      paidAt: r.paid_at,
      paymentReference: r.payment_reference,
      waiveReason: r.waive_reason,
    };
  });
  return { ready: true, rows, total: count ?? rows.length, totals, today };
}
