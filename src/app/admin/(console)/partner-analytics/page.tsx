import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/button";
import { requirePlatform } from "@/lib/platform/access";
import { formatMoney } from "@/lib/money";
import { formatDayKey, istDateKey } from "@/features/analytics/dates";
import { RANGE_PRESETS, RANK_BY, analyticsFilterSchema, resolveAnalyticsRange, tierLabel } from "@/features/partners/schemas";
import { leaderboardTotals, partnerLeaderboard, type LeaderboardRow } from "@/features/partners/server";
import { PendingMigrationNotice, searchInput } from "@/features/partners/components/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Partner analytics" };

const PRESET_LABEL = { "7d": "7 days", "30d": "30 days", "90d": "90 days", ytd: "Year to date" } as const;
const RANK_LABEL = { commission: "Commission", gmv: "GMV", licenses: "Licences" } as const;

export default async function PartnerAnalyticsPage({ searchParams }: PageProps<"/admin/partner-analytics">) {
  await requirePlatform("platform.finance.read");
  const f = analyticsFilterSchema.parse(await searchParams);
  const today = istDateKey(new Date());
  const range = resolveAnalyticsRange(f, today);
  const res = await partnerLeaderboard(range.from, range.to, f.rank);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ rank: f.rank, ...(range.preset ? { preset: range.preset } : { from: range.from, to: range.to }), ...extra }).toString();
  return (
    <div>
      <PageHeader
        title="Partner analytics"
        description={`Licence sales (GMV) and commissions by partner, ${formatDayKey(range.from)} – ${formatDayKey(range.to)} (IST).`}
        actions={
          res.available ? (
            <a href={`/admin/partner-analytics/export?${qs({})}`} className={buttonClass({ variant: "secondary" })}>
              <Download aria-hidden /> Export CSV
            </a>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <nav aria-label="Date presets" className="flex flex-wrap gap-1">
          {RANGE_PRESETS.map((p) => (
            <Link key={p} href={`/admin/partner-analytics?${new URLSearchParams({ preset: p, rank: f.rank })}`} aria-current={range.preset === p ? "page" : undefined} className={cn("h-9 rounded-md border px-3 text-small leading-9", range.preset === p ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-secondary")}>
              {PRESET_LABEL[p]}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-caption text-muted">
            From
            <input type="date" name="from" defaultValue={range.from} max={today} className={`${searchInput} mt-1 block`} />
          </label>
          <label className="text-caption text-muted">
            To
            <input type="date" name="to" defaultValue={range.to} max={today} className={`${searchInput} mt-1 block`} />
          </label>
          <label className="text-caption text-muted">
            Rank by
            <select name="rank" defaultValue={f.rank} className={`${searchInput} mt-1 block`}>
              {RANK_BY.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-9 rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
            Apply
          </button>
        </form>
      </div>
      {!res.available ? <PendingMigrationNotice what="Partner analytics" /> : <Leaderboard rows={res.data} rank={f.rank} />}
    </div>
  );
}

function Leaderboard({ rows, rank }: { rows: LeaderboardRow[]; rank: keyof typeof RANK_LABEL }) {
  const totals = leaderboardTotals(rows);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="GMV (licence sales)" value={formatMoney(totals.gmvMinor)} tone="mint" />
        <StatCard label="Commission earned" value={formatMoney(totals.commissionMinor)} tone="lavender" />
        <StatCard label="Licences issued" value={totals.licenses} tone="peach" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No partner activity in this period" description="Licence batches and commissions in the selected dates appear here. Try a longer range." />
      ) : (
        <Table caption={`Partners ranked by ${RANK_LABEL[rank].toLowerCase()}`}>
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>Partner</th>
              <th className={th}>Tier</th>
              <th className={th}>State</th>
              <th className={`${th} text-right`}>Licences</th>
              <th className={`${th} text-right`}>GMV</th>
              <th className={`${th} text-right`}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.partnerId}>
                <td className={`${td} tabular-nums text-muted`}>{i + 1}</td>
                <td className={td}>
                  <p className="font-medium">{r.name}</p>
                  <p className="font-mono text-caption text-muted">{r.code}</p>
                </td>
                <td className={td}>{tierLabel(r.tier)}</td>
                <td className={td}>{r.state ?? "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{r.licenses}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(r.gmvMinor)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(r.commissionMinor)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-2 text-caption text-muted">GMV is the licence batch value issued in the period; commission is accrued per month (months overlapping the period).</p>
    </>
  );
}
