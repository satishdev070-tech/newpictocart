import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader, Table, td, th } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { HttpStatusBadge } from "@/features/observability/components/status-badge";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { listErrorGroups, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Error tracking" };

export default async function PerformanceErrorsPage({
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
  const rows = await listErrorGroups(range);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Error tracking"
        description="Grouped error fingerprints from sampled request events."
        actions={<TimeRangeLinks basePath="/admin/performance/errors" active={rangeKey} />}
      />
      {rows.length === 0 ? (
        <EmptyTelemetry title="No error groups" />
      ) : (
        <Table caption="Error groups">
          <thead>
            <tr>
              <th className={th}>Fingerprint</th>
              <th className={th}>Route</th>
              <th className={th}>Status</th>
              <th className={th}>Count</th>
              <th className={th}>Last seen</th>
              <th className={th}>Sample</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} font-mono text-caption`}>{r.fingerprint.slice(0, 16)}</td>
                <td className={td}>{r.routeTemplate ?? "—"}</td>
                <td className={td}>{r.status != null ? <HttpStatusBadge status={r.status} /> : "—"}</td>
                <td className={`${td} tabular-nums`}>{r.occurrenceCount}</td>
                <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(r.lastSeenAt)}</td>
                <td className={`${td} max-w-sm truncate text-caption text-muted`}>{r.messageSample ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
