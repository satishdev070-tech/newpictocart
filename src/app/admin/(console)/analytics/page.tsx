import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Download, Eye, FileText, Users } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Card, PageHeader, StatCard } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDayKey, resolveDateRange } from "@/features/analytics/dates";
import { listPlatformSettings } from "@/features/platform/server/queries";
import { PUBLIC_CONFIG_KEYS } from "@/features/platform/public-config";
import { AnalyticsSettings } from "@/features/platform-analytics/components/analytics-settings";
import { loadTrafficReport, PAGE_VIEWS_MIGRATION } from "@/features/platform-analytics/server/report";
import { pagesPerVisit, type TrafficRow } from "@/features/platform-analytics/report";
import { loadGscState, type GscRow } from "@/features/search-console/server/store";
import { SearchConsoleCard, type GscCardState, type GscRowView } from "@/features/search-console/components/search-console-card";

export const metadata: Metadata = { title: "Analytics" };

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
] as const;
const ctl = "h-9 rounded-md border border-border bg-surface px-3 text-small";

function gscView(row: GscRow | null): GscRowView | null {
  if (!row) return null;
  const { filename, content, dns_value, active, updated_at, last_delivery_check_at, last_delivery_status, last_delivery_error, last_dns_check_at, last_dns_status } = row;
  return { filename, content, dns_value, active, updated_at, last_delivery_check_at, last_delivery_status, last_delivery_error, last_dns_check_at, last_dns_status };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const fmt = new Intl.NumberFormat("en-IN");

function TopTable({ title, keyLabel, rows, mono }: { title: string; keyLabel: string; rows: TrafficRow[]; mono?: boolean }) {
  return (
    <Card title={title}>
      {rows.length ? (
        <div className="-mx-4 -my-4 overflow-x-auto sm:-mx-5 sm:-my-5">
          <table className="w-full text-small">
            <thead className="text-left text-caption text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium sm:px-5">{keyLabel}</th>
                <th className="px-4 py-2.5 text-right font-medium">Views</th>
                <th className="px-4 py-2.5 text-right font-medium sm:pr-5">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-b-0">
                  <td className={cn("max-w-[18rem] truncate px-4 py-2.5 sm:px-5", mono && "font-mono text-caption")} title={r.key}>
                    {r.key}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt.format(r.views)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums sm:pr-5">{fmt.format(r.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-small text-muted">No data in this range yet.</p>
      )}
    </Card>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requirePlatform("platform.settings.manage");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const range = resolveDateRange({ range: one("range") ?? (one("from") && one("to") ? "custom" : null), from: one("from"), to: one("to") });
  // Plain reads only: no delivery / DNS checks run while this page renders.
  const [stored, traffic, gsc] = await Promise.all([listPlatformSettings(), loadTrafficReport(range.fromKey, range.toKey), loadGscState()]);
  const v = (k: string) => stored.get(k)?.value;
  const settings = {
    ga4Id: str(v(PUBLIC_CONFIG_KEYS.ga4)),
    ga4Enabled: bool(v(PUBLIC_CONFIG_KEYS.ga4Enabled), true),
    firstParty: bool(v(PUBLIC_CONFIG_KEYS.firstParty), true),
    metaPixel: str(v(PUBLIC_CONFIG_KEYS.metaPixel)),
    metaPixelEnabled: bool(v(PUBLIC_CONFIG_KEYS.metaPixelEnabled), true),
  };
  const gscState: GscCardState = gsc.ready
    ? { ready: true, domains: { production: { html: gscView(gsc.domains.production.html), dns: gscView(gsc.domains.production.dns) }, staging: { html: gscView(gsc.domains.staging.html), dns: gscView(gsc.domains.staging.dns) } } }
    : { ready: false };
  const csvQs = new URLSearchParams(range.preset === "custom" ? { from: range.fromKey, to: range.toKey } : { range: range.preset }).toString();

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" description="Google Analytics, Meta Pixel, Search Console verification, live visitor counts and the platform traffic report." />

      <AnalyticsSettings values={settings} />

      <Card title="Report filters">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-caption text-muted">
              From
              <input type="date" name="from" defaultValue={range.fromKey} max={range.toKey} className={`${ctl} mt-1 block`} />
            </label>
            <label className="text-caption text-muted">
              To
              <input type="date" name="to" defaultValue={range.toKey} className={`${ctl} mt-1 block`} />
            </label>
            <button className={buttonClass({ variant: "secondary" })}>Apply</button>
          </form>
          <nav aria-label="Date presets" className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Link key={p.value} href={`/admin/analytics?range=${p.value}`} aria-current={range.preset === p.value ? "page" : undefined} className={cn(ctl, "leading-9", range.preset === p.value ? "border-accent bg-accent-soft text-accent" : "hover:bg-surface-secondary")}>
                {p.label}
              </Link>
            ))}
            {traffic.available ? (
              <a href={`/admin/analytics/export?${csvQs}`} className={cn(ctl, "inline-flex items-center gap-1.5 hover:bg-surface-secondary")}>
                <Download aria-hidden className="size-4" /> CSV
              </a>
            ) : null}
          </nav>
        </div>
      </Card>

      {!traffic.available ? (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-small">
          {traffic.reason === "missing" ? (
            <>
              <p className="font-semibold">Visitor report isn&apos;t set up on this database yet</p>
              <p className="mt-1">
                Apply <code>supabase/migrations/{PAGE_VIEWS_MIGRATION}</code> in Supabase → SQL Editor, then reload. Google Analytics and Meta Pixel settings above already work.
              </p>
            </>
          ) : (
            <p>The visitor report couldn&apos;t be loaded just now. Reload to try again.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Visitors" value={fmt.format(traffic.report.visitors)} hint={`Unique sessions · ${range.label}`} icon={<Users />} />
            <StatCard label="Page views" value={fmt.format(traffic.report.views)} hint={range.label} icon={<Eye />} />
            <StatCard label="Visitors today" value={fmt.format(traffic.report.visitorsToday)} icon={<Users />} />
            <StatCard label="Views today" value={fmt.format(traffic.report.viewsToday)} icon={<Eye />} />
            <StatCard label="Pages / visit" value={pagesPerVisit(traffic.report).toFixed(2)} icon={<FileText />} />
          </div>

          <Card title="Daily visitors" description={`First-party unique sessions by day (IST), ${formatDayKey(range.fromKey)} – ${formatDayKey(range.toKey)}`}>
            {traffic.report.daily.length ? (
              <ul className="space-y-1.5">
                {(() => {
                  const max = Math.max(1, ...traffic.report.daily.map((d) => d.visitors));
                  return traffic.report.daily.map((d) => (
                    <li key={d.day} className="grid grid-cols-[6.5rem_1fr_4rem_4rem] items-center gap-3 text-caption">
                      <span className="font-mono text-muted">{d.day}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-secondary" aria-hidden>
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (d.visitors / max) * 100)}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{fmt.format(d.visitors)} vis</span>
                      <span className="text-right text-muted tabular-nums">{fmt.format(d.views)} pv</span>
                    </li>
                  ));
                })()}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-small text-muted">
                <BarChart3 aria-hidden className="size-4" /> No visits recorded in this range yet. Views appear here a few seconds after someone opens a platform page.
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <TopTable title="Top pages" keyLabel="Path" rows={traffic.report.topPages} mono />
            <TopTable title="Top referrers" keyLabel="Referrer" rows={traffic.report.topReferrers} />
          </div>
        </>
      )}

      <SearchConsoleCard state={gscState} />
    </div>
  );
}
