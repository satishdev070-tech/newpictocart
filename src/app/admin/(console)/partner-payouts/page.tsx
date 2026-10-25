import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { requirePlatform } from "@/lib/platform/access";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDayKey, istDateKey } from "@/features/analytics/dates";
import { defaultPayoutCutoff, payoutSummary, tierLabel } from "@/features/partners/schemas";
import { payoutHistory, pendingPayouts } from "@/features/partners/server";
import { RunPayoutBatchForm, SettlePayoutButtons } from "@/features/partners/components/forms";
import { PendingMigrationNotice, StatusBadge, searchInput } from "@/features/partners/components/ui";

export const metadata: Metadata = { title: "Partner payouts" };

const filterSchema = z.object({ cutoff: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined) });

export default async function PartnerPayoutsPage({ searchParams }: PageProps<"/admin/partner-payouts">) {
  const ctx = await requirePlatform("platform.finance.read");
  const canManage = ctx.permissions.has("platform.finance.manage");
  const today = istDateKey(new Date());
  const f = filterSchema.parse(await searchParams);
  const cutoff = f.cutoff && f.cutoff <= today ? f.cutoff : defaultPayoutCutoff(today);
  const [owed, history] = await Promise.all([pendingPayouts(cutoff), payoutHistory()]);
  if (!owed.available || !history.available) {
    return (
      <div>
        <PageHeader title="Partner payouts" />
        <PendingMigrationNotice what="Partner payouts" />
      </div>
    );
  }
  const totalMinor = owed.data.reduce((n, r) => n + r.totalMinor, 0);
  const initiated = history.data.filter((p) => p.status === "initiated");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner payouts"
        description="Commissions accrue monthly per attributed store. A batch groups everything owed up to the cutoff into one payout per partner; mark each paid with the bank UTR."
        actions={canManage ? <RunPayoutBatchForm cutoff={cutoff} today={today} /> : null}
      />
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-caption text-muted">
          Show pending up to
          <input type="date" name="cutoff" defaultValue={cutoff} max={today} className={`${searchInput} mt-1 block`} />
        </label>
        <button type="submit" className="h-9 rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
          Apply
        </button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Partners owed" value={owed.data.length} tone="lavender" />
        <StatCard label="Total pending" value={formatMoney(totalMinor)} tone="mint" hint={initiated.length ? `${initiated.length} payout${initiated.length === 1 ? "" : "s"} awaiting transfer` : undefined} />
        <StatCard label="Cutoff" value={formatDayKey(cutoff)} tone="peach" hint="Commissions accrue for a month once it has ended; running a batch accrues the cutoff month." />
      </div>

      <section>
        <h2 className="mb-2 text-h3">Pending by partner</h2>
        {owed.data.length === 0 ? (
          <EmptyState title="Nothing pending up to this cutoff" description="Accrued commissions that are not yet in a payout appear here." />
        ) : (
          <Table caption="Pending commissions by partner">
            <thead>
              <tr>
                <th className={th}>Partner</th>
                <th className={th}>Tier</th>
                <th className={th}>Payout details</th>
                <th className={`${th} text-right`}>Commissions</th>
                <th className={`${th} text-right`}>Direct</th>
                <th className={`${th} text-right`}>Override</th>
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {owed.data.map((r) => (
                <tr key={r.partnerId}>
                  <td className={td}>
                    <Link href={`/admin/partners/${r.partnerId}`} className="font-medium text-accent hover:underline">
                      {r.name}
                    </Link>
                    <p className="font-mono text-caption text-muted">{r.code}</p>
                  </td>
                  <td className={td}>{tierLabel(r.tier)}</td>
                  <td className={`${td} text-small`}>{payoutSummary(r)}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(r.directMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(r.overrideMinor)}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{formatMoney(r.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-h3">Payout history</h2>
        {history.data.length === 0 ? (
          <EmptyState title="No payouts yet" description={canManage ? "Run a batch to create payouts for what partners are owed." : "Payouts appear here once finance runs a batch."} />
        ) : (
          <Table caption="Payout history">
            <thead>
              <tr>
                <th className={th}>Partner</th>
                <th className={th}>Period</th>
                <th className={th}>Method</th>
                <th className={th}>UTR</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Amount</th>
                {canManage ? <th className={th}></th> : null}
              </tr>
            </thead>
            <tbody>
              {history.data.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <Link href={`/admin/partners/${p.partnerId}`} className="font-medium hover:underline">
                      {p.partnerName ?? "Partner"}
                    </Link>
                    <p className="font-mono text-caption text-muted">{p.partnerCode}</p>
                  </td>
                  <td className={td}>
                    Up to {formatDate(p.cutoff)}
                    <p className="text-caption text-muted">
                      {p.count} commission{p.count === 1 ? "" : "s"} · created {formatDate(p.createdAt)}
                    </p>
                  </td>
                  <td className={td}>{p.method.toUpperCase()}</td>
                  <td className={`${td} font-mono text-small`}>{p.utr ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge status={p.status} />
                    {p.status !== "initiated" && p.notes ? <p className="max-w-48 text-caption text-muted">{p.notes}</p> : null}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(p.amountMinor)}</td>
                  {canManage ? <td className={td}>{p.status === "initiated" ? <SettlePayoutButtons payoutId={p.id} amountMinor={p.amountMinor} /> : null}</td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
