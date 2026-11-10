import Link from "next/link";
import { Table, td, th } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import type { RequestEventRow } from "@/features/observability/server/queries";
import { DurationBadge, HttpStatusBadge } from "./status-badge";
import { EmptyTelemetry } from "./empty-telemetry";

export function RequestsTable({ rows }: { rows: RequestEventRow[] }) {
  if (rows.length === 0) return <EmptyTelemetry title="No request events" />;
  return (
    <Table caption="Request events">
      <thead>
        <tr>
          <th className={th}>When</th>
          <th className={th}>Method</th>
          <th className={th}>Route</th>
          <th className={th}>Status</th>
          <th className={th}>Duration</th>
          <th className={th}>Trace</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(r.timestamp)}</td>
            <td className={td}>
              <code className="text-caption">{r.method}</code>
            </td>
            <td className={td}>
              <Link href={`/admin/performance/requests/${r.id}`} className="font-medium hover:underline">
                {r.routeTemplate}
              </Link>
              {r.errorMessage ? <p className="mt-0.5 max-w-md truncate text-caption text-error">{r.errorMessage}</p> : null}
            </td>
            <td className={td}>
              <HttpStatusBadge status={r.status} />
            </td>
            <td className={td}>
              <DurationBadge ms={r.durationMs} />
            </td>
            <td className={`${td} font-mono text-caption text-muted`}>{r.traceId.slice(0, 8)}…</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
