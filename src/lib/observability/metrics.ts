/**
 * Fixed-bucket latency histograms that merge cheaply (sum counts per bucket).
 * Buckets are upper bounds in ms; the last is +Inf.
 */

export const LATENCY_BUCKET_MS = [50, 100, 200, 300, 500, 800, 1000, 2000, 5000, 10000, Number.POSITIVE_INFINITY] as const;

export type LatencyHistogram = {
  /** Count of observations that fell into each bucket (same length as LATENCY_BUCKET_MS). */
  counts: number[];
  sumMs: number;
  count: number;
};

export function emptyHistogram(): LatencyHistogram {
  return { counts: LATENCY_BUCKET_MS.map(() => 0), sumMs: 0, count: 0 };
}

function bucketIndex(ms: number): number {
  const n = Number.isFinite(ms) && ms > 0 ? ms : 0;
  for (let i = 0; i < LATENCY_BUCKET_MS.length; i++) {
    if (n <= LATENCY_BUCKET_MS[i]!) return i;
  }
  return LATENCY_BUCKET_MS.length - 1;
}

/** Mutates `histogram` (or a copy if you pass one) and returns it. */
export function recordLatency(histogram: LatencyHistogram, ms: number): LatencyHistogram {
  const n = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  const idx = bucketIndex(n);
  if (histogram.counts.length !== LATENCY_BUCKET_MS.length) {
    histogram.counts = LATENCY_BUCKET_MS.map((_, i) => histogram.counts[i] ?? 0);
  }
  histogram.counts[idx] = (histogram.counts[idx] ?? 0) + 1;
  histogram.sumMs += n;
  histogram.count += 1;
  return histogram;
}

export function mergeHistograms(a: LatencyHistogram, b: LatencyHistogram): LatencyHistogram {
  const counts = LATENCY_BUCKET_MS.map((_, i) => (a.counts[i] ?? 0) + (b.counts[i] ?? 0));
  return { counts, sumMs: a.sumMs + b.sumMs, count: a.count + b.count };
}

/**
 * Estimate a percentile from cumulative bucket counts (Prometheus-style).
 * Returns 0 when empty. `p` is 0–100 (e.g. 95 for p95).
 */
export function estimatePercentile(histogram: LatencyHistogram, p: number): number {
  if (histogram.count <= 0) return 0;
  const target = Math.max(0, Math.min(100, p)) / 100 * histogram.count;
  let cumulative = 0;
  let prevBound = 0;
  for (let i = 0; i < LATENCY_BUCKET_MS.length; i++) {
    const count = histogram.counts[i] ?? 0;
    const bound = LATENCY_BUCKET_MS[i]!;
    cumulative += count;
    if (cumulative >= target) {
      if (!Number.isFinite(bound)) return prevBound;
      if (count === 0) return bound;
      const rankInBucket = target - (cumulative - count);
      const frac = rankInBucket / count;
      return prevBound + (bound - prevBound) * frac;
    }
    if (Number.isFinite(bound)) prevBound = bound;
  }
  return prevBound;
}

/** Serialize for Postgres `bigint[]` (finite ints; +Inf bucket is last). */
export function histogramCountsForDb(histogram: LatencyHistogram): number[] {
  return LATENCY_BUCKET_MS.map((_, i) => Math.max(0, Math.floor(histogram.counts[i] ?? 0)));
}
