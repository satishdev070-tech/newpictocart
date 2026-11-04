import { describe, expect, it } from "vitest";
import { emptyHistogram, estimatePercentile, LATENCY_BUCKET_MS, mergeHistograms, recordLatency } from "@/lib/observability/metrics";

describe("latency histogram", () => {
  it("uses fixed buckets including +Inf", () => {
    expect(LATENCY_BUCKET_MS).toEqual([50, 100, 200, 300, 500, 800, 1000, 2000, 5000, 10000, Number.POSITIVE_INFINITY]);
  });

  it("records into the correct bucket and merges", () => {
    const a = emptyHistogram();
    recordLatency(a, 40);
    recordLatency(a, 120);
    expect(a.count).toBe(2);
    expect(a.counts[0]).toBe(1); // <=50
    expect(a.counts[2]).toBe(1); // <=200

    const b = emptyHistogram();
    recordLatency(b, 40);
    const m = mergeHistograms(a, b);
    expect(m.count).toBe(3);
    expect(m.counts[0]).toBe(2);
    expect(m.sumMs).toBe(40 + 120 + 40);
  });

  it("estimates percentiles from buckets", () => {
    const h = emptyHistogram();
    for (let i = 0; i < 10; i++) recordLatency(h, 40); // all in <=50
    expect(estimatePercentile(h, 50)).toBeGreaterThanOrEqual(0);
    expect(estimatePercentile(h, 95)).toBeLessThanOrEqual(50);
    expect(estimatePercentile(emptyHistogram(), 95)).toBe(0);

    const mixed = emptyHistogram();
    for (let i = 0; i < 9; i++) recordLatency(mixed, 40);
    recordLatency(mixed, 1500);
    const p95 = estimatePercentile(mixed, 95);
    expect(p95).toBeGreaterThan(50);
    expect(p95).toBeLessThanOrEqual(2000);
  });
});
