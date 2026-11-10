import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { Card, PageHeader } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { OverviewKpis } from "@/features/observability/components/overview-kpis";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { getOverviewMetrics, resolveTimeRange } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Performance overview" };

export default async function PerformanceOverviewPage({
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
  const metrics = await getOverviewMetrics(range);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance overview"
        description="Platform request volume, errors, and latency from sampled telemetry."
        actions={<TimeRangeLinks basePath="/admin/performance" active={rangeKey} />}
      />
      {metrics.totalRequests === 0 ? (
        <EmptyTelemetry />
      ) : (
        <>
          <OverviewKpis metrics={metrics} />
          <Card
            title="Live API monitor"
            description="Inspect recent sampled requests and pause auto-refresh on the live view."
            actions={
              <Link href={`/admin/performance/requests?range=${rangeKey}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                Open live monitor
              </Link>
            }
          >
            <p className="text-small text-muted">
              Window {new Date(range.from).toLocaleString("en-IN")} → {new Date(range.to).toLocaleString("en-IN")} · source{" "}
              <code className="font-mono text-caption">{metrics.source}</code>
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
