import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { InsightsList } from "@/features/observability/components/insights-list";
import { TimeRangeLinks, activeRangeKey } from "@/features/observability/components/time-range-links";
import { buildPerformanceInsights } from "@/features/observability/server/insights";
import {
  getOverviewMetrics,
  listErrorGroups,
  listSlowEndpoints,
  listSpanAggregates,
  resolveTimeRange,
} from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Performance insights" };

export default async function PerformanceInsightsPage({
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

  const [overview, slow, errors, spans] = await Promise.all([
    getOverviewMetrics(range),
    listSlowEndpoints(range),
    listErrorGroups(range),
    listSpanAggregates(range, "auth"),
  ]);

  const insights = buildPerformanceInsights({
    overview,
    slow,
    errors,
    spans,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Performance insights"
        description="Deterministic, evidence-based cards from metrics and auth spans — no inferred root causes."
        actions={<TimeRangeLinks basePath="/admin/performance/insights" active={rangeKey} />}
      />
      {overview.totalRequests === 0 && insights.length <= 1 ? (
        <EmptyTelemetry />
      ) : (
        <InsightsList insights={insights} />
      )}
    </div>
  );
}
