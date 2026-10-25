import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { requirePlatform } from "@/lib/platform/access";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/features/analytics/dates";
import { bpsToPercentLabel } from "@/features/platform-finance/calc";
import { maskAccount, payoutSummary, tierLabel, typeLabel } from "@/features/partners/schemas";
import { getPartnerDetail } from "@/features/partners/server";
import {
  AgencyPayoutForm,
  AttributeStoreForm,
  CreditForms,
  DirectRateForm,
  IssueBatchForm,
  MarkBatchPaidButton,
  ParentForm,
  PartnerProfileForm,
  PartnerStatusSelect,
  PayoutDetailsForm,
  PromoteForm,
  RemoveAttributionButton,
  RevokeLicenseButton,
} from "@/features/partners/components/forms";
import { PendingMigrationNotice, StatusBadge } from "@/features/partners/components/ui";

export const metadata: Metadata = { title: "Partner" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PartnerDetailPage({ params }: PageProps<"/admin/partners/[id]">) {
  await requirePlatform("platform.partners.manage");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const res = await getPartnerDetail(id);
  const back = (
    <Link href="/admin/partners" className="hover:underline">
      ← All partners
    </Link>
  );
  if (!res.available) {
    return (
      <div>
        <PageHeader title="Partner" back={back} />
        <PendingMigrationNotice />
      </div>
    );
  }
  if (!res.data) notFound();
  const { partner: p, org, parent, team, parentOptions, batches, licenses, stores, commissions, payouts, ledger, invites } = res.data;
  const pendingCommissionMinor = commissions.filter((c) => c.status === "pending" || c.status === "batched").reduce((n, c) => n + c.amountMinor, 0);
  const pendingInvite = invites.find((i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={p.name}
        description={
          <>
            <span className="font-mono">{p.code}</span> · {tierLabel(p.tier)} · {typeLabel(p.type)}
            {p.companyName ? ` · ${p.companyName}` : ""} · {p.email}
            {p.userId ? " · account linked" : " · no account linked yet"}
          </>
        }
        actions={<PartnerStatusSelect partnerId={p.id} status={p.status} />}
      />
      {pendingInvite ? <p className="rounded-md border border-info/25 bg-info/10 px-3 py-2 text-small text-info">Invite sent {formatDate(pendingInvite.createdAt)}; it expires {formatDate(pendingInvite.expiresAt)}.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Credit balance" value={formatMoney(p.creditMinor)} tone="mint" hint="Applied to the next licence batch" />
        <StatCard label="Licences" value={`${org?.licensesTotal ?? licenses.length}`} tone="lavender" hint={`${org?.licensesRedeemed ?? licenses.filter((l) => l.status === "consumed").length} redeemed${p.type === "agency" ? " (incl. team)" : ""}`} />
        <StatCard label="Total paid" value={formatMoney(org?.amountPaidMinor ?? 0)} tone="peach" hint="Paid licence batches" />
        <StatCard label="Commission owed" value={formatMoney(pendingCommissionMinor)} tone="sky" hint={`Direct ${bpsToPercentLabel(p.directBps)} · override ${bpsToPercentLabel(p.overrideBps)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Profile">
          <PartnerProfileForm p={p} />
        </Card>
        <Card title="Payout details" description={`Current: ${payoutSummary(p)}. The full account number is never shown.`}>
          <PayoutDetailsForm p={p} />
        </Card>
      </div>

      <Card title="Tier, upline and rates" description={parent ? `Reports to ${parent.name} (${parent.code}).` : "Reports directly to the platform."}>
        <div className="grid gap-8 lg:grid-cols-2">
          <PromoteForm p={p} />
          <div className="space-y-6">
            <ParentForm partnerId={p.id} parentId={p.parentId} options={parentOptions} />
            <DirectRateForm partnerId={p.id} directBps={p.directBps} />
            {p.type === "agency" ? <AgencyPayoutForm partnerId={p.id} agencyBps={p.agencyPayoutBps} /> : null}
          </div>
        </div>
      </Card>

      <Card title={`Credit · ${formatMoney(p.creditMinor)}`} description="Onboarding credit and one-time codes reduce what the partner pays for licences.">
        <CreditForms partnerId={p.id} />
        {ledger.length ? (
          <ul className="mt-6 divide-y divide-border border-t border-border text-small">
            {ledger.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-medium capitalize">{l.kind.replaceAll("_", " ")}</span>
                  {l.note ? <span className="text-muted"> · {l.note}</span> : null}
                  <span className="block text-caption text-muted">{formatDateTime(l.createdAt)}</span>
                </span>
                <span className={`tabular-nums ${l.deltaMinor > 0 ? "text-success" : "text-error"}`}>
                  {l.deltaMinor > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(l.deltaMinor))} <span className="text-muted">· {formatMoney(l.balanceMinor)} left</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Licence batches" actions={<IssueBatchForm partnerId={p.id} defaultPriceMinor={p.licensePriceMinor} disabled={p.status !== "active"} />} description={p.status !== "active" ? "Activate the partner to issue licences." : undefined}>
        {batches.length === 0 ? (
          <p className="text-small text-muted">No batches issued yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[720px] text-left text-body">
              <thead>
                <tr>
                  <th className={th}>Batch</th>
                  <th className={th}>Plan</th>
                  <th className={`${th} text-right`}>Qty × price</th>
                  <th className={`${th} text-right`}>Credit</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={th}>Payment</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className={td}>
                      <span className="font-mono text-small">{b.number}</span>
                      <p className="text-caption text-muted">{formatDate(b.createdAt)}</p>
                    </td>
                    <td className={td}>{b.type}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {b.qty} × {formatMoney(b.unitPriceMinor)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{b.creditAppliedMinor ? `−${formatMoney(b.creditAppliedMinor)}` : "—"}</td>
                    <td className={`${td} text-right tabular-nums font-medium`}>{formatMoney(b.totalMinor)}</td>
                    <td className={td}>
                      <StatusBadge status={b.paymentStatus} />
                      {b.reference ? <p className="text-caption text-muted">{b.reference}</p> : null}
                    </td>
                    <td className={td}>{b.paymentStatus === "pending" ? <MarkBatchPaidButton batchId={b.id} partnerId={p.id} number={b.number} totalMinor={b.totalMinor} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Licences (${licenses.length})`}>
        {licenses.length === 0 ? (
          <p className="text-small text-muted">No licence keys yet.</p>
        ) : (
          <div className="-mx-4 max-h-[480px] overflow-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-left text-body">
              <thead>
                <tr>
                  <th className={th}>Key</th>
                  <th className={th}>Plan</th>
                  <th className={th}>Status</th>
                  <th className={th}>Store</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id}>
                    <td className={`${td} font-mono text-small`}>{l.key}</td>
                    <td className={td}>{l.type}</td>
                    <td className={td}>
                      <StatusBadge status={l.status} />
                    </td>
                    <td className={td}>{l.tenantId ? <Link href={`/admin/tenants/${l.tenantId}`} className="hover:underline">{l.storeName ?? l.tenantId}</Link> : "—"}</td>
                    <td className={td}>{l.status === "available" ? <RevokeLicenseButton licenseId={l.id} partnerId={p.id} licenseKey={l.key} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Attributed stores (${stores.length})`} description="Commission accrues monthly on each active store's plan price.">
        <AttributeStoreForm partnerId={p.id} />
        {stores.length ? (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {stores.map((s) => (
              <li key={s.tenantId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/tenants/${s.tenantId}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>{" "}
                  <StatusBadge status={s.status === "trial" ? "pending" : s.status} />
                  <p className="text-caption text-muted">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {s.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" aria-hidden />
                    </a>{" "}
                    · {s.source === "license" ? "via licence" : "assigned"} {formatDate(s.createdAt)}
                  </p>
                </div>
                <RemoveAttributionButton partnerId={p.id} slug={s.slug} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {team.length || p.type === "agency" ? (
        <Card title={`Team (${team.length})`} description="Partners who report to this partner.">
          {team.length === 0 ? (
            <p className="text-small text-muted">No team members yet. Set this partner as the parent on an agent&apos;s or intern&apos;s page.</p>
          ) : (
            <Table caption="Team">
              <thead>
                <tr>
                  <th className={th}>Partner</th>
                  <th className={th}>Type</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Licences</th>
                  <th className={`${th} text-right`}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>
                      <Link href={`/admin/partners/${m.id}`} className="font-medium text-accent hover:underline">
                        {m.name}
                      </Link>
                      <p className="font-mono text-caption text-muted">{m.code}</p>
                    </td>
                    <td className={td}>
                      {typeLabel(m.type)} · {tierLabel(m.tier)}
                    </td>
                    <td className={td}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {m.licensesTotal} <span className="text-muted">/ {m.licensesRedeemed}</span>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(m.amountPaidMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Commissions">
          {commissions.length === 0 ? (
            <p className="text-small text-muted">No commissions yet. They accrue when a payout batch runs for an ended month.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-auto text-small">
              {commissions.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium capitalize">{c.kind}</span> · {c.storeName ?? "Store"} · {c.month.slice(0, 7)}
                    <span className="block text-caption text-muted">
                      {bpsToPercentLabel(c.rateBps)} of {formatMoney(c.baseMinor)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatMoney(c.amountMinor)}</span>
                    <StatusBadge status={c.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Payouts">
          {payouts.length === 0 ? (
            <p className="text-small text-muted">No payouts yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-auto text-small">
              {payouts.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    Up to {formatDate(x.cutoff)} · {x.method.toUpperCase()}
                    <span className="block text-caption text-muted">
                      {x.count} commission{x.count === 1 ? "" : "s"}
                      {x.utr ? ` · UTR ${x.utr}` : ""}
                      {x.notes ? ` · ${x.notes}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatMoney(x.amountMinor)}</span>
                    <StatusBadge status={x.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-caption text-muted">
            Payout account: {p.payoutMethod === "bank" ? `${p.bankAccountHolder ?? "—"} · ${maskAccount(p.bankLast4)}` : (p.upiId ?? "not set")}. Payouts are run on{" "}
            <Link href="/admin/partner-payouts" className="underline">
              Partner payouts
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}
