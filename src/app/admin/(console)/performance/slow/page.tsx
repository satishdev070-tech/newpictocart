import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader, Table, td, th } from "@/components/ui/layout";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { DurationBadge } from "@/features/observability/components/status-badge";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { listSlowEndpoints, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Slow APIs" };

export default async function PerformanceSlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatform("platform.observability.read");
  const sp = await searchParams;
  const rangeKey = activeRangeKey(typeof sp.range === "string" ? sp.range : undefined);
  const range = resolveTimeRange({
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
    range: rangeKey,
  });
  const rows = await listSlowEndpoints(range);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Slow APIs"
        description="Endpoints ranked by average latency in the selected window."
        actions={<TimeRangeLinks basePath="/admin/performance/slow" active={rangeKey} />}
      />
      {rows.length === 0 ? (
        <EmptyTelemetry title="No slow-endpoint data" />
      ) : (
        <Table caption="Slow endpoints">
          <thead>
            <tr>
              <th className={th}>Method</th>
              <th className={th}>Route</th>
              <th className={th}>Requests</th>
              <th className={th}>Slow</th>
              <th className={th}>Avg</th>
              <th className={th}>P95</th>
              <th className={th}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.method}|${r.routeTemplate}`}>
                <td className={td}>
                  <code className="text-caption">{r.method}</code>
                </td>
                <td className={`${td} font-medium`}>{r.routeTemplate}</td>
                <td className={`${td} tabular-nums`}>{r.requestCount}</td>
                <td className={`${td} tabular-nums`}>{r.slowCount}</td>
                <td className={td}>
                  <DurationBadge ms={r.avgLatencyMs} />
                </td>
                <td className={td}>
                  <DurationBadge ms={r.p95Ms} />
                </td>
                <td className={`${td} tabular-nums`}>{r.errorCount}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
