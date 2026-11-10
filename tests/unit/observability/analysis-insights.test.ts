import { describe, expect, it } from "vitest";
import {
  aggregateSpansByName,
  authSpanInsightSeeds,
  AUTH_SPAN_NAME_RE,
  DB_SPAN_NAME_RE,
  slowRouteInsightSeeds,
} from "@/features/observability/analysis";
import { buildPerformanceInsights } from "@/features/observability/server/insights";

describe("span aggregate filters", () => {
  it("matches auth and db span name patterns", () => {
    expect(AUTH_SPAN_NAME_RE.test("session.getClaims")).toBe(true);
    expect(AUTH_SPAN_NAME_RE.test("sign_in.landingPathFor")).toBe(true);
    expect(AUTH_SPAN_NAME_RE.test("db.query")).toBe(false);
    expect(DB_SPAN_NAME_RE.test("db.products.select")).toBe(true);
    expect(DB_SPAN_NAME_RE.test("supabase.from")).toBe(true);
    expect(DB_SPAN_NAME_RE.test("rpc.get_cart")).toBe(true);
    expect(DB_SPAN_NAME_RE.test("session.getClaims")).toBe(false);
  });

  it("aggregates durations by name with optional filter", () => {
    const aggs = aggregateSpansByName(
      [
        [
          { name: "session.getClaims", startMs: 0, endMs: 120 },
          { name: "db.query", startMs: 0, endMs: 40 },
        ],
        [{ name: "session.getClaims", startMs: 0, endMs: 200, status: "ok" }],
      ],
      AUTH_SPAN_NAME_RE,
    );
    expect(aggs).toHaveLength(1);
    expect(aggs[0]!.name).toBe("session.getClaims");
    expect(aggs[0]!.count).toBe(2);
    expect(aggs[0]!.avgMs).toBe(160);
  });
});

describe("authSpanInsightSeeds", () => {
  it("does not invent insights without enough slow samples", () => {
    expect(
      authSpanInsightSeeds([{ name: "session.getClaims", count: 2, avgMs: 900, maxMs: 900, errorCount: 0, p95Ms: 900 }], {
        slowMs: 800,
        minSamples: 3,
      }),
    ).toHaveLength(0);
  });

  it("emits evidence-based insight when auth span is slow", () => {
    const seeds = authSpanInsightSeeds(
      [{ name: "session.getClaims", count: 10, avgMs: 950, maxMs: 1200, errorCount: 0, p95Ms: 1100 }],
      { slowMs: 800, minSamples: 3 },
    );
    expect(seeds).toHaveLength(1);
    expect(seeds[0]!.title).toContain("session.getClaims");
    expect(seeds[0]!.detail).toContain("10 samples");
    expect(seeds[0]!.detail).toMatch(/Evidence|measured/i);
  });
});

describe("slowRouteInsightSeeds / buildPerformanceInsights", () => {
  it("flags slow routes from snapshots", () => {
    const seeds = slowRouteInsightSeeds(
      [{ routeTemplate: "/api/x", method: "GET", requestCount: 20, errorCount: 0, p95Ms: 900 }],
      { slowMs: 800 },
    );
    expect(seeds[0]!.detail).toContain("/api/x");
  });

  it("includes auth span insights when overview has traffic", () => {
    const insights = buildPerformanceInsights({
      overview: {
        totalRequests: 50,
        errorCount: 0,
        errorRate: 0,
        avgLatencyMs: 200,
        p50Ms: 100,
        p95Ms: 300,
        p99Ms: 400,
        slowCount: 0,
        source: "events",
      },
      slow: [],
      errors: [],
      spans: [{ name: "sign_in.getSessionUser", count: 8, avgMs: 1500, maxMs: 2000, errorCount: 0, p95Ms: 1800 }],
    });
    expect(insights.some((i) => i.id.startsWith("auth-span:"))).toBe(true);
  });
});
