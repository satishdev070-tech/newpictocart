import { StatCard } from "@/components/ui/layout";
import type { OverviewMetrics } from "@/features/observability/server/queries";

const nf = new Intl.NumberFormat("en-IN");
const pct = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 2 });

export function OverviewKpis({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="mint"
        label="Requests"
        value={nf.format(metrics.totalRequests)}
        hint={metrics.source === "metrics" ? "From endpoint rollups" : metrics.source === "events" ? "From sampled events" : "No data"}
      />
      <StatCard
        tone="rose"
        label="Error rate"
        value={pct.format(metrics.errorRate)}
        hint={`${nf.format(metrics.errorCount)} × 5xx`}
      />
      <StatCard tone="sky" label="Avg latency" value={`${metrics.avgLatencyMs} ms`} hint={`${nf.format(metrics.slowCount)} slow`} />
      <StatCard
        tone="amber"
        label="P50 / P95 / P99"
        value={`${metrics.p50Ms} / ${metrics.p95Ms} / ${metrics.p99Ms}`}
        hint="ms · estimated from histograms or sample"
      />
    </div>
  );
}
