import "server-only";
import { getSlowMs } from "@/lib/observability/config";
import {
  authSpanInsightSeeds,
  slowRouteInsightSeeds,
  type SpanAggregate,
} from "../analysis";
import type { OverviewMetrics, SlowEndpointRow, ErrorGroupRow } from "./queries";

export type PerformanceInsight = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  href?: string;
};

/**
 * Deterministic insights from overview + slow endpoints + error groups + optional
 * span aggregates. No LLM — same inputs always yield the same cards. Span-based
 * auth insights only cite measured names (session.getClaims / sign_in.* / …).
 */
export function buildPerformanceInsights(input: {
  overview: OverviewMetrics;
  slow: SlowEndpointRow[];
  errors: ErrorGroupRow[];
  /** Optional span aggregates (e.g. from listSpanAggregates). */
  spans?: SpanAggregate[];
}): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const { overview, slow, errors, spans = [] } = input;
  const slowMs = getSlowMs();

  if (overview.source === "empty" || overview.totalRequests === 0) {
    insights.push({
      id: "no-telemetry",
      severity: "info",
      title: "No telemetry in this range",
      detail: "Enable OBSERVABILITY_ENABLED and generate traffic (e.g. hit /login) to populate metrics.",
      href: "/admin/performance/settings",
    });
    return insights;
  }

  for (const seed of authSpanInsightSeeds(spans, { slowMs, minSamples: 3 })) {
    insights.push(seed);
  }

  if (overview.errorRate >= 0.05) {
    insights.push({
      id: "high-error-rate",
      severity: overview.errorRate >= 0.15 ? "critical" : "warning",
      title: "Elevated error rate",
      detail: `${(overview.errorRate * 100).toFixed(1)}% of sampled requests returned 5xx (${overview.errorCount.toLocaleString("en-IN")} of ${overview.totalRequests.toLocaleString("en-IN")}).`,
      href: "/admin/performance/errors",
    });
  }

  if (overview.p95Ms >= slowMs) {
    insights.push({
      id: "high-p95",
      severity: overview.p95Ms >= 2000 ? "critical" : "warning",
      title: "P95 latency above slow threshold",
      detail: `Estimated P95 is ${Math.round(overview.p95Ms)} ms (slow threshold ${slowMs} ms). Average is ${overview.avgLatencyMs} ms.`,
      href: "/admin/performance/slow",
    });
  }

  const loginSlow = slow.find((s) => /\/login|\/seller\/login/i.test(s.routeTemplate) && s.avgLatencyMs >= slowMs);
  if (loginSlow) {
    insights.push({
      id: "slow-login",
      severity: loginSlow.avgLatencyMs >= 2000 ? "critical" : "warning",
      title: "Slow login route",
      detail: `${loginSlow.method} ${loginSlow.routeTemplate} averages ${loginSlow.avgLatencyMs} ms (P95 ${loginSlow.p95Ms} ms) across ${loginSlow.requestCount} requests.`,
      href: "/admin/performance/slow",
    });
  }

  const topSlow = slow[0];
  if (topSlow && topSlow.avgLatencyMs >= slowMs && !loginSlow) {
    insights.push({
      id: "top-slow-endpoint",
      severity: topSlow.avgLatencyMs >= 2000 ? "critical" : "warning",
      title: "Slowest endpoint in range",
      detail: `${topSlow.method} ${topSlow.routeTemplate} averages ${topSlow.avgLatencyMs} ms with ${topSlow.slowCount} slow samples.`,
      href: "/admin/performance/slow",
    });
  }

  // Extra slow-route seeds from p95 when overview lists don't already cover them.
  if (!loginSlow && !topSlow) {
    for (const seed of slowRouteInsightSeeds(
      slow.map((s) => ({
        routeTemplate: s.routeTemplate,
        method: s.method,
        requestCount: s.requestCount,
        errorCount: s.errorCount,
        p95Ms: s.p95Ms,
      })),
      { slowMs },
    )) {
      if (!insights.some((i) => i.id === seed.id)) insights.push(seed);
    }
  }

  const hotError = errors[0];
  if (hotError && hotError.occurrenceCount >= 5) {
    insights.push({
      id: "hot-error-group",
      severity: hotError.occurrenceCount >= 25 ? "critical" : "warning",
      title: "Recurring error fingerprint",
      detail: `"${hotError.messageSample ?? hotError.fingerprint}" seen ${hotError.occurrenceCount} times${hotError.routeTemplate ? ` on ${hotError.routeTemplate}` : ""}.`,
      href: "/admin/performance/errors",
    });
  }

  if (overview.slowCount > 0 && overview.slowCount / overview.totalRequests >= 0.1) {
    insights.push({
      id: "many-slow",
      severity: "warning",
      title: "Many slow requests",
      detail: `${overview.slowCount.toLocaleString("en-IN")} requests (≥ ${slowMs} ms) — ${(
        (overview.slowCount / overview.totalRequests) *
        100
      ).toFixed(0)}% of volume.`,
      href: "/admin/performance/requests",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "healthy",
      severity: "info",
      title: "No performance red flags",
      detail: `Sampled ${overview.totalRequests.toLocaleString("en-IN")} requests with ${(overview.errorRate * 100).toFixed(2)}% errors and P95 ${Math.round(overview.p95Ms)} ms.`,
    });
  }

  return insights;
}
