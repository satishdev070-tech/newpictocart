import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Hourglass, Receipt, ShoppingBag } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/features/analytics/dates";
import { bpsToPercentLabel } from "@/features/platform-finance/calc";
import { INVOICE_FILTER_STATUSES, commissionListFilterSchema, defaultInvoiceMonth, type InvoiceDisplayStatus } from "@/features/platform-finance/schemas";
import { listCommissionInvoices } from "@/features/platform-finance/server/commissions";
import { GenerateInvoicesForm, MarkInvoicePaidButton, WaiveInvoiceButton } from "@/features/platform-finance/components/commission-controls";
import { PendingMigrationNotice } from "@/features/platform-finance/components/pending-migration";

export const metadata: Metadata = { title: "Commissions" };

const ctl = "h-9 rounded-md border border-border bg-surface px-3 text-small";
const TONE: Record<InvoiceDisplayStatus, "warning" | "success" | "neutral" | "error"> = { pending: "warning", paid: "success", waived: "neutral", overdue: "error" };
const LABEL: Record<InvoiceDisplayStatus, string> = { pending: "Pending", paid: "Paid", waived: "Waived", overdue: "Overdue" };

/** "2026-09-01" → "Sep 2026" (period starts are calendar dates, no timezone shift). */
function monthLabel(date: string): string {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function CommissionsPage({ searchParams }: PageProps<"/admin/commissions">) {
  const ctx = await requirePlatform("platform.finance.read");
  const f = commissionListFilterSchema.parse(await searchParams);
  const list = await listCommissionInvoices(f);
  const canManage = ctx.permissions.has("platform.finance.manage");
  const header = <PageHeader title="Commissions" description="Monthly GMV commission invoices per store, at each store's plan rate (Admin → Plans)." />;
  if (!list.ready) {
    return (
      <div className="space-y-6">
        {header}
        <PendingMigrationNotice what="Commissions" />
      </div>
    );
  }
  const { rows, total, totals } = list;
  const filtered = Boolean(f.q || f.status);
  const defaultMonth = defaultInvoiceMonth();
  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced GMV" tone="sky" icon={<ShoppingBag />} value={formatMoney(totals.gmvMinor)} hint={`${totals.count} invoice${totals.count === 1 ? "" : "s"}`} />
        <StatCard label="Commission" tone="lavender" icon={<Receipt />} value={formatMoney(totals.commissionMinor)} hint={totals.waivedMinor ? `${formatMoney(totals.waivedMinor)} waived` : undefined} />
        <StatCard label="Collected" tone="mint" icon={<BadgeCheck />} value={formatMoney(totals.collectedMinor)} />
        <StatCard label="Outstanding" tone="rose" icon={<Hourglass />} value={formatMoney(totals.outstandingMinor)} hint={totals.overdueMinor ? `${formatMoney(totals.overdueMinor)} overdue` : "Nothing overdue"} />
      </div>

      {canManage ? (
        <Card title="Generate invoices" description="One invoice per store with commissionable GMV in the month, at its current plan rate, due 15 days after the month ends. Safe to re-run: stores already invoiced for the month are skipped.">
          <GenerateInvoicesForm defaultMonth={defaultMonth} maxMonth={defaultMonth} />
        </Card>
      ) : null}

      <div>
        <form className="mb-4 grid gap-2 sm:flex sm:flex-wrap sm:items-end" role="search">
          <label className="sr-only" htmlFor="q">Search invoices</label>
          <input id="q" name="q" defaultValue={f.q ?? ""} placeholder="Invoice # or store name" className={`${ctl} sm:min-w-72 sm:flex-1`} />
          <label className="sr-only" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={f.status ?? ""} className={ctl}>
            <option value="">All statuses</option>
            {INVOICE_FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>{LABEL[s]}</option>
            ))}
          </select>
          <button className={`${ctl} font-medium`}>Apply</button>
          {filtered ? <Link href="/admin/commissions" className="text-small text-accent hover:underline">Clear</Link> : null}
        </form>

        {rows.length ? (
          <Table caption="Commission invoices">
            <thead>
              <tr>
                <th className={th}>Invoice #</th>
                <th className={th}>Store</th>
                <th className={th}>Period</th>
                <th className={`${th} text-right`}>GMV</th>
                <th className={`${th} text-right`}>Commission</th>
                <th className={th}>Status</th>
                {canManage ? <th className={th}><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-mono text-small`}>{r.invoiceNumber}</td>
                  <td className={td}>
                    <Link href={`/admin/tenants/${r.tenantId}`} className="font-medium hover:underline">{r.storeName ?? "Unknown store"}</Link>
                    {r.storeSlug ? <span className="block font-mono text-caption text-muted">{r.storeSlug}</span> : null}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{monthLabel(r.periodStart)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(r.gmvMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {formatMoney(r.commissionMinor)}
                    <span className="block text-caption text-muted">{bpsToPercentLabel(r.rateBps)}</span>
                  </td>
                  <td className={td}>
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                    <span className="block text-caption text-muted">
                      {r.status === "paid"
                        ? `Paid ${formatDate(r.paidAt)}${r.paymentReference ? ` · ${r.paymentReference}` : ""}`
                        : r.status === "waived"
                          ? (r.waiveReason ?? "")
                          : `Due ${formatDate(`${r.dueDate}T00:00:00+05:30`)}`}
                    </span>
                  </td>
                  {canManage ? (
                    <td className={td}>
                      {r.status === "pending" || r.status === "overdue" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <MarkInvoicePaidButton invoiceId={r.id} invoiceNumber={r.invoiceNumber} amount={formatMoney(r.commissionMinor)} />
                          <WaiveInvoiceButton invoiceId={r.id} invoiceNumber={r.invoiceNumber} amount={formatMoney(r.commissionMinor)} />
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title={filtered ? "No invoices match" : "No commission invoices yet"}
            description={filtered ? "Try a different search or clear the filters." : "Set a GMV commission % on Admin → Plans, then run invoice generation for a finished month."}
          />
        )}
        <Pagination page={f.page} pageSize={f.pageSize} total={total} basePath="/admin/commissions" params={{ q: f.q, status: f.status }} />
      </div>
    </div>
  );
}
