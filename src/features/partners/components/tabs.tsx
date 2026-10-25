import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { Card, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, istDateKey } from "@/features/analytics/dates";
import { LICENSE_STATUSES, tierLabel, typeLabel } from "../schemas";
import { codeDisplayStatus, licenseCounts, listCodes, listDemoShops, listLicenseRequests, listLicenses, listPartnerOptions, listPartnerOrgs } from "../server";
import { CreateCodeButton, DecideRequestButtons, DemoShopControls, DemoShopForm, LicenseRequestForm, PartnerStatusSelect, RevokeCodeButton, RevokeLicenseButton } from "./forms";
import { PendingMigrationNotice, StatusBadge, searchInput } from "./ui";

/** Server-rendered bodies of the /admin/partners tabs. */

function SearchForm({ tab, q, placeholder, children }: { tab: string; q?: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="tab" value={tab} />
      <div className="relative min-w-64 flex-1">
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" name="q" defaultValue={q ?? ""} placeholder={placeholder} className={`${searchInput} w-full pl-9`} />
      </div>
      {children}
      <button type="submit" className="h-9 rounded-md border border-border bg-surface px-3 text-small font-medium hover:bg-surface-secondary">
        Apply
      </button>
    </form>
  );
}

export async function PartnersTab({ q }: { q?: string }) {
  const res = await listPartnerOrgs("all", q);
  if (!res.available) return <PendingMigrationNotice />;
  const rows = res.data;
  return (
    <>
      <SearchForm tab="partners" q={q} placeholder="Name, company, email or partner ID" />
      {rows.length === 0 ? (
        <EmptyState title={q ? "No partners match" : "No partners yet"} description={q ? "Try a different search." : "Invite a partner or create one directly to get started."} />
      ) : (
        <Table caption="Partners">
          <thead>
            <tr>
              <th className={th}>Partner ID</th>
              <th className={th}>Name / company</th>
              <th className={th}>Tier</th>
              <th className={th}>Type</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Licences</th>
              <th className={`${th} text-right`}>Total paid</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={`${td} font-mono text-small`}>{p.code}</td>
                <td className={td}>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-caption text-muted">
                    {p.companyName ? `${p.companyName} · ` : ""}
                    {p.email}
                  </p>
                  {p.parentName ? <p className="text-caption text-muted">Under {p.parentName}</p> : null}
                </td>
                <td className={td}>{tierLabel(p.tier)}</td>
                <td className={td}>{typeLabel(p.type)}</td>
                <td className={td}>
                  <PartnerStatusSelect partnerId={p.id} status={p.status} />
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {p.licensesTotal}
                  <span className="text-muted"> / {p.licensesRedeemed} redeemed</span>
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(p.amountPaidMinor)}</td>
                <td className={td}>
                  <Link href={`/admin/partners/${p.id}`} className="text-small font-medium text-accent hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {rows.some((r) => r.type === "agency") ? <p className="mt-2 text-caption text-muted">Agency licences and totals include their agents and interns.</p> : null}
    </>
  );
}

export async function RequestsTab() {
  const [res, partners] = await Promise.all([listLicenseRequests(), listPartnerOptions()]);
  if (!res.available) return <PendingMigrationNotice />;
  const rows = res.data;
  const open = rows.filter((r) => r.status === "pending").length;
  return (
    <Card title={`License requests${open ? ` (${open} pending)` : ""}`} description="Partners ask for licences; approving issues a batch of keys. Create a request here on a partner's behalf." actions={<LicenseRequestForm partners={partners} />}>
      {rows.length === 0 ? (
        <p className="text-small text-muted">No licence requests yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.qty} × {r.type} <StatusBadge status={r.status} />
                </p>
                <p className="text-small">
                  <Link href={`/admin/partners/${r.partnerId}`} className="text-accent hover:underline">
                    {r.partnerName ?? "Partner"}
                  </Link>
                  {r.partnerCode ? <span className="font-mono text-caption text-muted"> {r.partnerCode}</span> : null}
                </p>
                <p className="text-caption text-muted">
                  Requested {formatDateTime(r.createdAt)}
                  {r.notes ? ` · ${r.notes}` : ""}
                  {r.reviewedAt ? ` · decided ${formatDate(r.reviewedAt)}` : ""}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                </p>
              </div>
              {r.status === "pending" ? <DecideRequestButtons requestId={r.id} qty={r.qty} defaultPriceMinor={r.licensePriceMinor} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export async function LicensesTab({ q, status }: { q?: string; status?: string }) {
  const [res, all] = await Promise.all([listLicenses({ status, q }), status || q ? listLicenses({}) : null]);
  if (!res.available) return <PendingMigrationNotice />;
  const counts = licenseCounts(all?.available ? all.data : res.data);
  const rows = res.data;
  return (
    <>
      <p className="mb-3 text-small text-muted">
        {counts.available} available · {counts.consumed} redeemed · {counts.revoked} revoked
      </p>
      <SearchForm tab="licenses" q={q} placeholder="Licence key, partner or store">
        <label className="sr-only" htmlFor="status">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={searchInput}>
          <option value="">All statuses</option>
          {LICENSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "consumed" ? "Redeemed" : s[0]!.toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </SearchForm>
      {rows.length === 0 ? (
        <EmptyState title={q || status ? "No licences match" : "No licences issued yet"} description={q || status ? "Try a different filter." : "Issue a batch from a partner's page or approve a licence request."} />
      ) : (
        <Table caption="Licences">
          <thead>
            <tr>
              <th className={th}>Key</th>
              <th className={th}>Plan</th>
              <th className={th}>Partner</th>
              <th className={th}>Status</th>
              <th className={th}>Store</th>
              <th className={th}>Issued</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((l) => (
              <tr key={l.id}>
                <td className={`${td} font-mono text-small`}>{l.key}</td>
                <td className={td}>{l.type}</td>
                <td className={td}>
                  <Link href={`/admin/partners/${l.partnerId}`} className="text-accent hover:underline">
                    {l.partnerName ?? "Partner"}
                  </Link>
                </td>
                <td className={td}>
                  <StatusBadge status={l.status} />
                </td>
                <td className={td}>
                  {l.tenantId ? (
                    <Link href={`/admin/tenants/${l.tenantId}`} className="hover:underline">
                      {l.storeName ?? l.tenantId}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {l.consumedAt ? <p className="text-caption text-muted">{formatDate(l.consumedAt)}</p> : null}
                </td>
                <td className={td}>{formatDate(l.createdAt)}</td>
                <td className={td}>{l.status === "available" ? <RevokeLicenseButton licenseId={l.id} partnerId={l.partnerId} licenseKey={l.key} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {rows.length > 500 ? <p className="mt-2 text-caption text-muted">Showing the newest 500 of {rows.length}. Narrow the search to see more.</p> : null}
    </>
  );
}

export async function DemoShopsTab() {
  const res = await listDemoShops();
  if (!res.available) return <PendingMigrationNotice />;
  const { shops, candidates } = res.data;
  return (
    <div className="space-y-6">
      <Card title="Add a demo shop" description="Partners show these stores to prospects. Pick from stores whose type is Demo (set on the store page). Shoppers browse them like any storefront; no login details are stored here.">
        <DemoShopForm candidates={candidates} />
      </Card>
      {shops.length === 0 ? (
        <EmptyState title="No demo shops listed" description="Add a demo store above to show it to partners." />
      ) : (
        <Table caption="Demo shops">
          <thead>
            <tr>
              <th className={th}>Store</th>
              <th className={th}>Category</th>
              <th className={th}>Note</th>
              <th className={th}>Visible</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  <p className="font-medium">{s.name}</p>
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-caption text-accent hover:underline">
                    {s.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" aria-hidden />
                  </a>
                  {s.storeType !== "demo" ? <p className="text-caption text-warning">This store is no longer marked Demo.</p> : null}
                </td>
                <td className={td}>{s.category}</td>
                <td className={`${td} max-w-xs text-small text-muted`}>{s.note ?? "—"}</td>
                <td className={td}>
                  <StatusBadge status={s.active ? "active" : "void"} />
                </td>
                <td className={td}>
                  <DemoShopControls id={s.id} active={s.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export async function CodesTab() {
  const res = await listCodes();
  if (!res.available) return <PendingMigrationNotice />;
  const rows = res.data;
  const today = istDateKey(new Date());
  return (
    <Card title="One-time codes" description="Each code adds its value to one partner's licence credit, once. Only a hash and the last four characters are stored." actions={<CreateCodeButton />}>
      {rows.length === 0 ? (
        <p className="text-small text-muted">No codes generated yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-left text-body">
            <thead>
              <tr>
                <th className={th}>Code</th>
                <th className={`${th} text-right`}>Value</th>
                <th className={th}>Status</th>
                <th className={th}>Expires</th>
                <th className={th}>Used by</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const status = codeDisplayStatus(c, today);
                return (
                  <tr key={c.id}>
                    <td className={td}>
                      <span className="font-mono text-small">OTC-…{c.hint}</span>
                      {c.note ? <p className="text-caption text-muted">{c.note}</p> : null}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(c.valueMinor)}</td>
                    <td className={td}>
                      <StatusBadge status={status} />
                    </td>
                    <td className={td}>{c.expiresAt ? formatDate(c.expiresAt) : "Never"}</td>
                    <td className={td}>
                      {c.usedById ? (
                        <Link href={`/admin/partners/${c.usedById}`} className="text-accent hover:underline">
                          {c.usedBy ?? "Partner"}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {c.usedAt ? <p className="text-caption text-muted">{formatDate(c.usedAt)}</p> : null}
                    </td>
                    <td className={td}>{c.status === "active" ? <RevokeCodeButton codeId={c.id} hint={c.hint} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
