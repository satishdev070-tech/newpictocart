/**
 * Analysis helpers: endpoint metrics → alert snapshots, and evidence-based
 * span aggregates / insight seeds. Pure (no DB). No fabricated root causes —
 * every insight cites measured span names, counts, and averages.
 */

import { emptyHistogram, estimatePercentile, LATENCY_BUCKET_MS, type LatencyHistogram } from "@/lib/observability/metrics";
import { errorRate, type AlertMetricSnapshot } from "./alert-evaluation";

export type EndpointMetricRow = {
  route_template: string;
  method?: string | null;
  request_count: number;
  error_count: number;
  latency_bucket_counts?: number[] | null;
  latency_sum_ms?: number | null;
};

/** Minimal span shape used for aggregation (matches stored jsonb / SpanRecord). */
export type AnalysisSpan = {
  name: string;
  startMs: number;
  endMs?: number;
  status?: "ok" | "error";
};

export type SpanAggregate = {
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  errorCount: number;
  /** Estimated p95 from sample durations (0 when empty). */
  p95Ms: number;
};

/** Auth / login-path span names we can cite with evidence (not guesses). */
export const AUTH_SPAN_NAME_RE =
  /^(proxy\.claims|session\.getClaims|session\.profile|sign_in\.|landing\.)/i;

/** Spans that look like database work from stored event jsonb names. */
export const DB_SPAN_NAME_RE = /db\.|supabase\.|\brpc\b/i;

/** Build a LatencyHistogram from a stored bigint[] bucket array (length 11). */
export function histogramFromBucketCounts(counts: readonly number[] | null | undefined, sumMs = 0): LatencyHistogram {
  const h = emptyHistogram();
  if (!counts || counts.length === 0) return h;
  for (let i = 0; i < LATENCY_BUCKET_MS.length; i++) {
    h.counts[i] = Math.max(0, Math.floor(counts[i] ?? 0));
  }
  h.count = h.counts.reduce((a, b) => a + b, 0);
  h.sumMs = Number.isFinite(sumMs) && sumMs > 0 ? sumMs : 0;
  return h;
}

export function p95FromBucketCounts(counts: readonly number[] | null | undefined): number {
  return estimatePercentile(histogramFromBucketCounts(counts), 95);
}

/** One snapshot per input row (no merge). */
export function snapshotsFromEndpointMetrics(rows: readonly EndpointMetricRow[]): AlertMetricSnapshot[] {
  return rows.map((row) => ({
    routeTemplate: row.route_template,
    method: row.method ?? undefined,
    requestCount: Math.max(0, row.request_count),
    errorCount: Math.max(0, row.error_count),
    p95Ms: p95FromBucketCounts(row.latency_bucket_counts),
  }));
}

/**
 * Merge rows that share route_template (+ optional method) into one snapshot
 * (sums counts; merges latency buckets for a combined p95).
 */
export function mergeEndpointMetrics(rows: readonly EndpointMetricRow[], groupByMethod = false): AlertMetricSnapshot[] {
  type Acc = {
    routeTemplate: string;
    method?: string;
    requestCount: number;
    errorCount: number;
    histogram: LatencyHistogram;
  };
  const map = new Map<string, Acc>();

  for (const row of rows) {
    const method = groupByMethod ? (row.method ?? undefined) : undefined;
    const key = groupByMethod ? `${row.route_template}::${method ?? ""}` : row.route_template;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        routeTemplate: row.route_template,
        method,
        requestCount: 0,
        errorCount: 0,
        histogram: emptyHistogram(),
      };
      map.set(key, acc);
    }
    acc.requestCount += Math.max(0, row.request_count);
    acc.errorCount += Math.max(0, row.error_count);
    const part = histogramFromBucketCounts(row.latency_bucket_counts, row.latency_sum_ms ?? 0);
    for (let i = 0; i < LATENCY_BUCKET_MS.length; i++) {
      acc.histogram.counts[i] = (acc.histogram.counts[i] ?? 0) + (part.counts[i] ?? 0);
    }
    acc.histogram.count += part.count;
    acc.histogram.sumMs += part.sumMs;
  }

  return [...map.values()].map((acc) => ({
    routeTemplate: acc.routeTemplate,
    method: acc.method,
    requestCount: acc.requestCount,
    errorCount: acc.errorCount,
    p95Ms: estimatePercentile(acc.histogram, 95),
  }));
}

export function summarizeSnapshot(snapshot: AlertMetricSnapshot): {
  routeTemplate: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p95Ms: number;
} {
  return {
    routeTemplate: snapshot.routeTemplate,
    requestCount: snapshot.requestCount,
    errorCount: snapshot.errorCount,
    errorRate: errorRate(snapshot.requestCount, snapshot.errorCount),
    p95Ms: snapshot.p95Ms,
  };
}

function spanDurationMs(span: AnalysisSpan): number {
  return Math.max(0, (span.endMs ?? span.startMs) - span.startMs);
}

function percentileFromSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

/**
 * Aggregate spans by name. Optional `nameFilter` keeps only matching names
 * (e.g. AUTH_SPAN_NAME_RE / DB_SPAN_NAME_RE).
 */
export function aggregateSpansByName(
  spanLists: readonly (readonly AnalysisSpan[])[],
  nameFilter?: RegExp,
): SpanAggregate[] {
  const map = new Map<string, { durations: number[]; errors: number }>();
  for (const spans of spanLists) {
    for (const span of spans) {
      if (!span.name) continue;
      if (nameFilter && !nameFilter.test(span.name)) continue;
      let entry = map.get(span.name);
      if (!entry) {
        entry = { durations: [], errors: 0 };
        map.set(span.name, entry);
      }
      entry.durations.push(spanDurationMs(span));
      if (span.status === "error") entry.errors += 1;
    }
  }
  return [...map.entries()]
    .map(([name, e]) => {
      const sorted = [...e.durations].sort((a, b) => a - b);
      const sum = e.durations.reduce((a, b) => a + b, 0);
      const count = e.durations.length;
      return {
        name,
        count,
        avgMs: count ? Math.round(sum / count) : 0,
        maxMs: count ? Math.round(sorted[sorted.length - 1] ?? 0) : 0,
        errorCount: e.errors,
        p95Ms: Math.round(percentileFromSorted(sorted, 95)),
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs || b.count - a.count);
}

export type SpanInsightSeed = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  href?: string;
};

/**
 * Deterministic auth/login span insights. Only fires when sample count and
 * avg/p95 exceed thresholds — cites span name + numbers, never invents causes.
 */
export function authSpanInsightSeeds(
  aggs: readonly SpanAggregate[],
  opts?: { slowMs?: number; minSamples?: number },
): SpanInsightSeed[] {
  const slowMs = opts?.slowMs ?? 800;
  const minSamples = opts?.minSamples ?? 3;
  const seeds: SpanInsightSeed[] = [];

  const auth = aggs.filter((a) => AUTH_SPAN_NAME_RE.test(a.name));
  for (const a of auth) {
    if (a.count < minSamples) continue;
    const hot = a.avgMs >= slowMs || a.p95Ms >= slowMs;
    if (!hot) continue;
    const metric = a.p95Ms >= a.avgMs ? `p95 ${a.p95Ms} ms` : `avg ${a.avgMs} ms`;
    seeds.push({
      id: `auth-span:${a.name}`,
      severity: a.avgMs >= 2000 || a.p95Ms >= 2000 ? "critical" : "warning",
      title: `High auth latency: ${a.name}`,
      detail: `Span "${a.name}" measured ${metric} across ${a.count} samples (max ${a.maxMs} ms; slow threshold ${slowMs} ms). Evidence from stored request-event spans only — root cause not inferred.`,
      href: "/admin/performance/requests?route=/login",
    });
  }

  // Slow routes from metrics are handled elsewhere; here only span evidence.
  return seeds;
}

/**
 * Slow-route insight seeds from endpoint metric snapshots (evidence: p95 + count).
 */
export function slowRouteInsightSeeds(
  snapshots: readonly AlertMetricSnapshot[],
  opts?: { slowMs?: number; minRequests?: number },
): SpanInsightSeed[] {
  const slowMs = opts?.slowMs ?? 800;
  const minRequests = opts?.minRequests ?? 5;
  const seeds: SpanInsightSeed[] = [];
  const ranked = [...snapshots]
    .filter((s) => s.requestCount >= minRequests && s.p95Ms >= slowMs)
    .sort((a, b) => b.p95Ms - a.p95Ms);
  const top = ranked[0];
  if (!top) return seeds;
  seeds.push({
    id: `slow-route:${top.routeTemplate}:${top.method ?? ""}`,
    severity: top.p95Ms >= 2000 ? "critical" : "warning",
    title: `Slow route: ${top.routeTemplate}`,
    detail: `${top.method ?? "GET"} ${top.routeTemplate} p95 ${Math.round(top.p95Ms)} ms over ${top.requestCount} requests (threshold ${slowMs} ms).`,
    href: "/admin/performance/slow",
  });
  return seeds;
}
