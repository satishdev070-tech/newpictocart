import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { DurationBadge } from "@/features/observability/components/status-badge";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { listSpanAggregates, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Database performance" };

export default async function PerformanceDatabasePage({
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
  const rows = await listSpanAggregates(range, "db");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Database performance"
        description="Aggregates of spans whose names contain db., supabase., or rpc — from sampled request events."
        actions={<TimeRangeLinks basePath="/admin/performance/database" active={rangeKey} />}
      />
      <Card title="About this view">
        <p className="text-small text-muted">
          This page reads application-emitted span names only. Enabling Postgres{" "}
          <code className="font-mono text-caption">pg_stat_statements</code> is optional ops tooling
          outside the app — it is not required for this dashboard and is not queried here.
        </p>
      </Card>
      {rows.length === 0 ? (
        <EmptyTelemetry title="No database-like spans" />
      ) : (
        <Table caption="Database span aggregates">
          <thead>
            <tr>
              <th className={th}>Span</th>
              <th className={th}>Count</th>
              <th className={th}>Avg</th>
              <th className={th}>Max</th>
              <th className={th}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className={`${td} font-mono text-small`}>{r.name}</td>
                <td className={`${td} tabular-nums`}>{r.count}</td>
                <td className={td}>
                  <DurationBadge ms={r.avgMs} />
                </td>
                <td className={td}>
                  <DurationBadge ms={r.maxMs} />
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
