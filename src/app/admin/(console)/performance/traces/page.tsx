import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, PageHeader, Table, td, th } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { DurationBadge } from "@/features/observability/components/status-badge";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { listRequestEvents, listTraces, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Distributed traces" };

export default async function PerformanceTracesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatform("platform.observability.read");
  const sp = await searchParams;
  const rangeKey = activeRangeKey(typeof sp.range === "string" ? sp.range : undefined);
  const traceFilter = typeof sp.trace === "string" ? sp.trace : undefined;
  const range = resolveTimeRange({
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
    range: rangeKey,
  });

  if (traceFilter) {
    const { rows } = await listRequestEvents({
      from: range.from,
      to: range.to,
      limit: 100,
    });
    const matched = rows.filter((r) => r.traceId === traceFilter);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Trace detail"
          description={traceFilter}
          back={
            <Link href={`/admin/performance/traces?range=${rangeKey}`} className="hover:underline">
              ← Traces
            </Link>
          }
        />
        {matched.length === 0 ? (
          <EmptyTelemetry title="No events for this trace in range" />
        ) : (
          <Table caption="Trace events">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Route</th>
                <th className={th}>Duration</th>
                <th className={th}>Spans</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(r.timestamp)}</td>
                  <td className={td}>
                    <Link href={`/admin/performance/requests/${r.id}`} className="hover:underline">
                      {r.method} {r.routeTemplate}
                    </Link>
                  </td>
                  <td className={td}>
                    <DurationBadge ms={r.durationMs} />
                  </td>
                  <td className={`${td} tabular-nums`}>{r.spans.length}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    );
  }

  const traces = await listTraces(range, 50);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Distributed traces"
        description="Trace IDs rolled up from sampled request events (MVP — same request_id/trace_id)."
        actions={<TimeRangeLinks basePath="/admin/performance/traces" active={rangeKey} />}
      />
      {traces.length === 0 ? (
        <EmptyTelemetry title="No traces yet" />
      ) : (
        <Table caption="Traces">
          <thead>
            <tr>
              <th className={th}>Trace</th>
              <th className={th}>Events</th>
              <th className={th}>Max duration</th>
              <th className={th}>Routes</th>
              <th className={th}>Last seen</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.traceId}>
                <td className={`${td} font-mono text-caption`}>
                  <Link
                    href={`/admin/performance/traces?range=${rangeKey}&trace=${encodeURIComponent(t.traceId)}`}
                    className="hover:underline"
                  >
                    {t.traceId.slice(0, 12)}…
                  </Link>
                </td>
                <td className={`${td} tabular-nums`}>{t.eventCount}</td>
                <td className={td}>
                  <DurationBadge ms={t.maxDurationMs} />
                </td>
                <td className={`${td} max-w-md truncate text-caption`}>{t.routes.join(", ")}</td>
                <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(t.lastTimestamp)}</td>
                <td className={td}>
                  <Badge tone={t.hasError ? "error" : "success"}>{t.hasError ? "Has 5xx" : "OK"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
