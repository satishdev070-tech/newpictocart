import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { requirePlatform } from "@/lib/platform/access";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/features/analytics/dates";
import { AGENCY_TABS, TYPE_LABEL, agenciesPageSchema, tierLabel, typeLabel, type AgencyTab } from "@/features/partners/schemas";
import { listPartnerOrgs, orgTotals, type PartnerOrgRow } from "@/features/partners/server";
import { PendingMigrationNotice, StatusBadge, TabNav, searchInput } from "@/features/partners/components/ui";

export const metadata: Metadata = { title: "Agencies" };

const TAB_LABEL: Record<AgencyTab, string> = { agency: "Agencies", freelancer: "Freelancers", intern: "Interns", agent: "Agents", all: "All" };
const NOUN: Record<AgencyTab, string> = { agency: "agencies", freelancer: "freelancers", intern: "interns", agent: "agents", all: "partners" };

export default async function AgenciesPage({ searchParams }: PageProps<"/admin/agencies">) {
  await requirePlatform("platform.partners.manage");
  const f = agenciesPageSchema.parse(await searchParams);
  const res = await listPartnerOrgs(f.type, f.q);
  const href = (t: AgencyTab) => (t === "agency" ? "/admin/agencies" : `/admin/agencies?type=${t}`);
  return (
    <div>
      <PageHeader title="Agencies" description="Partner organisations with server-side totals. Agency numbers include their agents and interns." />
      <TabNav label="Partner types" active={f.type} tabs={AGENCY_TABS.map((t) => ({ key: t, label: TAB_LABEL[t], href: href(t) }))} />
      {!res.available ? (
        <PendingMigrationNotice what="The agencies list" />
      ) : (
        <AgencyList rows={res.data} type={f.type} q={f.q} />
      )}
    </div>
  );
}

function AgencyList({ rows, type, q }: { rows: PartnerOrgRow[]; type: AgencyTab; q?: string }) {
  const totals = orgTotals(rows);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={type === "all" ? "Partners" : TAB_LABEL[type]} value={totals.count} tone="lavender" />
        <StatCard label="Licences redeemed" value={totals.licensesRedeemed} tone="mint" hint={`of ${totals.licensesTotal} issued`} />
        <StatCard label="Amount paid" value={formatMoney(totals.amountPaidMinor)} tone="peach" hint="Paid licence batches" />
        <StatCard label="Team members" value={totals.teamCount} tone="sky" />
      </div>
      <form role="search" className="mb-4 flex flex-wrap gap-2">
        {type !== "agency" ? <input type="hidden" name="type" value={type} /> : null}
        <div className="relative min-w-64 flex-1">
          <label className="sr-only" htmlFor="q">
            Search
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="q" name="q" defaultValue={q ?? ""} placeholder="Name, company, email or partner ID" className={`${searchInput} w-full pl-9`} />
        </div>
        <button type="submit" className="h-9 rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title={q ? `No ${NOUN[type]} match “${q}”` : `No ${NOUN[type]} yet`}
          description={q ? "Try a different search." : type === "all" ? "Invite a partner from All partners to get started." : `Partners of type ${TYPE_LABEL[type]} appear here. Invite one from All partners, or change a partner's type on their page.`}
          action={
            <Link href="/admin/partners" className="text-small font-medium text-accent hover:underline">
              Go to All partners
            </Link>
          }
        />
      ) : (
        <Table caption={TAB_LABEL[type]}>
          <thead>
            <tr>
              <th className={th}>Owner</th>
              <th className={th}>Type / tier</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Team</th>
              <th className={`${th} text-right`}>Licences redeemed</th>
              <th className={`${th} text-right`}>Amount paid</th>
              <th className={th}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/admin/partners/${r.id}`} className="font-medium text-accent hover:underline">
                    {r.companyName ?? r.name}
                  </Link>
                  <p className="text-caption text-muted">
                    {r.companyName ? `${r.name} · ` : ""}
                    <span className="font-mono">{r.code}</span>
                  </p>
                  {r.parentName ? <p className="text-caption text-muted">Under {r.parentName}</p> : null}
                </td>
                <td className={td}>
                  {typeLabel(r.type)} · {tierLabel(r.tier)}
                </td>
                <td className={td}>
                  <StatusBadge status={r.status} />
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.teamCount}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.licensesRedeemed} <span className="text-muted">/ {r.licensesTotal}</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(r.amountPaidMinor)}</td>
                <td className={td}>{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
