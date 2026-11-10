import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { LivePoll } from "@/features/observability/components/live-poll";
import { RequestsTable } from "@/features/observability/components/requests-table";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { listRequestEvents, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Live API monitor" };

const ctl = "rounded-md border border-border bg-surface px-3 py-2 text-sm";

export default async function PerformanceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatform("platform.observability.read");
  const sp = await searchParams;
  const rangeKey = activeRangeKey(typeof sp.range === "string" ? sp.range : undefined);
  const route = typeof sp.route === "string" ? sp.route : undefined;
  const statusRaw = typeof sp.status === "string" ? Number(sp.status) : undefined;
  const status = statusRaw != null && Number.isFinite(statusRaw) ? statusRaw : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const range = resolveTimeRange({
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
    range: rangeKey,
  });
  const { rows, nextCursor } = await listRequestEvents({
    from: range.from,
    to: range.to,
    route,
    status,
    cursor,
    limit: 50,
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    p.set("range", rangeKey);
    if (route) p.set("route", route);
    if (status != null) p.set("status", String(status));
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return `/admin/performance/requests?${p}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live API monitor"
        description="Recent sampled request events. Auto-refreshes every 8 seconds while this tab is visible."
        actions={
          <div className="flex flex-col items-end gap-2">
            <TimeRangeLinks basePath="/admin/performance/requests" active={rangeKey} extraParams={{ route, status: status != null ? String(status) : undefined }} />
            <LivePoll intervalMs={8000} />
          </div>
        }
      />
      <form className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="range" value={rangeKey} />
        <label className="sr-only" htmlFor="route">
          Route
        </label>
        <input id="route" name="route" defaultValue={route ?? ""} placeholder="Route contains…" className={ctl} />
        <label className="sr-only" htmlFor="status">
          Status
        </label>
        <input id="status" name="status" defaultValue={status ?? ""} placeholder="Status e.g. 500" className={`${ctl} w-32`} />
        <button className={ctl}>Filter</button>
      </form>
      <RequestsTable rows={rows} />
      <nav className="flex justify-between text-sm" aria-label="Pagination">
        <span />
        {nextCursor ? (
          <Link href={qs({ cursor: nextCursor })} className="text-accent hover:underline">
            Older →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
