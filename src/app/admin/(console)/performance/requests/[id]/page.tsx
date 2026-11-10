import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import { DurationBadge, HttpStatusBadge } from "@/features/observability/components/status-badge";
import { SpansTimeline } from "@/features/observability/components/spans-timeline";
import { getRequestEvent } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Request event" };

export default async function RequestEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatform("platform.observability.read");
  const { id } = await params;
  const event = await getRequestEvent(id);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${event.method} ${event.routeTemplate}`}
        description={`Request ${event.requestId}`}
        back={
          <Link href="/admin/performance/requests" className="hover:underline">
            ← Live API monitor
          </Link>
        }
        actions={<DurationBadge ms={event.durationMs} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Overview">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-small">
            <dt className="text-muted">When</dt>
            <dd>{formatDateTime(event.timestamp)}</dd>
            <dt className="text-muted">Status</dt>
            <dd>
              <HttpStatusBadge status={event.status} />
            </dd>
            <dt className="text-muted">Duration</dt>
            <dd className="tabular-nums">{event.durationMs} ms</dd>
            <dt className="text-muted">Environment</dt>
            <dd>{event.environment}</dd>
            <dt className="text-muted">Service</dt>
            <dd>{event.service}</dd>
            <dt className="text-muted">Trace</dt>
            <dd className="font-mono text-caption">
              <Link href={`/admin/performance/traces?trace=${encodeURIComponent(event.traceId)}`} className="hover:underline">
                {event.traceId}
              </Link>
            </dd>
            <dt className="text-muted">Tenant</dt>
            <dd className="font-mono text-caption">{event.tenantId ?? "—"}</dd>
            {event.errorMessage ? (
              <>
                <dt className="text-muted">Error</dt>
                <dd className="text-error">
                  {event.errorFingerprint ? <Badge tone="error">{event.errorFingerprint.slice(0, 12)}</Badge> : null}{" "}
                  {event.errorMessage}
                </dd>
              </>
            ) : null}
          </dl>
        </Card>
        <Card title="Attributes">
          {Object.keys(event.attrs).length ? (
            <pre className="max-h-72 overflow-auto rounded-md bg-surface-secondary p-3 text-caption">
              {JSON.stringify(event.attrs, null, 2)}
            </pre>
          ) : (
            <p className="text-small text-muted">No attributes.</p>
          )}
        </Card>
      </div>

      <Card title="Spans timeline" description="Wall-clock spans stored on this event (jsonb).">
        <SpansTimeline spans={event.spans} totalMs={event.durationMs} />
      </Card>
    </div>
  );
}
