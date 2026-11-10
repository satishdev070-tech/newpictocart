import { describe, expect, it } from "vitest";
import {
  DEFAULT_COOLDOWN_MINUTES,
  errorRate,
  evaluateAlerts,
  type AlertCooldownIncident,
  type AlertMetricSnapshot,
  type AlertRuleForEval,
} from "@/features/observability/alert-evaluation";
import {
  histogramFromBucketCounts,
  mergeEndpointMetrics,
  p95FromBucketCounts,
  snapshotsFromEndpointMetrics,
} from "@/features/observability/analysis";
import { emptyHistogram, recordLatency } from "@/lib/observability/metrics";

const baseMetric = (over: Partial<AlertMetricSnapshot> = {}): AlertMetricSnapshot => ({
  routeTemplate: "/login",
  method: "GET",
  requestCount: 100,
  errorCount: 0,
  p95Ms: 200,
  ...over,
});

const baseRule = (over: Partial<AlertRuleForEval> = {}): AlertRuleForEval => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Login p95",
  enabled: true,
  ruleType: "p95",
  config: { thresholdMs: 500, cooldownMinutes: 30, severity: "warning" },
  ...over,
});

describe("errorRate / analysis helpers", () => {
  it("computes error rate safely", () => {
    expect(errorRate(0, 5)).toBe(0);
    expect(errorRate(100, 5)).toBe(0.05);
  });

  it("derives p95 from bucket counts", () => {
    const h = emptyHistogram();
    for (let i = 0; i < 20; i++) recordLatency(h, 40);
    expect(p95FromBucketCounts(h.counts)).toBeLessThanOrEqual(50);
    expect(histogramFromBucketCounts(null).count).toBe(0);
  });

  it("builds and merges endpoint metric snapshots", () => {
    const rows = [
      { route_template: "/api/a", method: "GET", request_count: 10, error_count: 1, latency_bucket_counts: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { route_template: "/api/a", method: "GET", request_count: 10, error_count: 1, latency_bucket_counts: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { route_template: "/api/b", method: "POST", request_count: 5, error_count: 0, latency_bucket_counts: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ];
    expect(snapshotsFromEndpointMetrics(rows)).toHaveLength(3);
    const merged = mergeEndpointMetrics(rows);
    expect(merged).toHaveLength(2);
    const a = merged.find((m) => m.routeTemplate === "/api/a")!;
    expect(a.requestCount).toBe(20);
    expect(a.errorCount).toBe(2);
  });
});

describe("evaluateAlerts", () => {
  const now = new Date("2026-11-04T12:00:00.000Z");

  it("creates an incident when p95 exceeds the rule", () => {
    const proposed = evaluateAlerts(
      [baseMetric({ p95Ms: 900 })],
      [baseRule()],
      [],
      now,
    );
    expect(proposed).toHaveLength(1);
    expect(proposed[0]!.ruleId).toBe(baseRule().id);
    expect(proposed[0]!.details.p95Ms).toBe(900);
    expect(proposed[0]!.summary).toContain("p95");
  });

  it("creates an incident when error rate exceeds the rule", () => {
    const proposed = evaluateAlerts(
      [baseMetric({ errorCount: 20, requestCount: 100 })],
      [baseRule({ ruleType: "error_rate", config: { thresholdRate: 0.1, minRequests: 10 } })],
      [],
      now,
    );
    expect(proposed).toHaveLength(1);
    expect(proposed[0]!.details.errorRate).toBe(0.2);
  });

  it("fires p95_or_error_rate when either threshold is breached", () => {
    const rule = baseRule({
      ruleType: "p95_or_error_rate",
      config: { thresholdMs: 500, thresholdRate: 0.05, cooldownMinutes: 30 },
    });
    expect(evaluateAlerts([baseMetric({ p95Ms: 100, errorCount: 10 })], [rule], [], now)).toHaveLength(1);
    expect(evaluateAlerts([baseMetric({ p95Ms: 800, errorCount: 0 })], [rule], [], now)).toHaveLength(1);
    expect(evaluateAlerts([baseMetric({ p95Ms: 100, errorCount: 0 })], [rule], [], now)).toHaveLength(0);
  });

  it("does not fire when under thresholds or disabled", () => {
    expect(evaluateAlerts([baseMetric({ p95Ms: 100 })], [baseRule()], [], now)).toHaveLength(0);
    expect(
      evaluateAlerts([baseMetric({ p95Ms: 900 })], [baseRule({ enabled: false })], [], now),
    ).toHaveLength(0);
  });

  it("respects routeTemplate filter", () => {
    const rule = baseRule({ config: { thresholdMs: 100, routeTemplate: "/checkout" } });
    expect(evaluateAlerts([baseMetric({ p95Ms: 900 })], [rule], [], now)).toHaveLength(0);
    expect(
      evaluateAlerts([baseMetric({ routeTemplate: "/checkout", p95Ms: 900 })], [rule], [], now),
    ).toHaveLength(1);
  });

  it("skips when an open incident is within cooldown", () => {
    const rule = baseRule();
    const recent: AlertCooldownIncident[] = [
      {
        ruleId: rule.id,
        routeTemplate: "/login",
        status: "open",
        openedAt: "2026-11-04T11:45:00.000Z", // 15 min ago; default cooldown 30
      },
    ];
    expect(evaluateAlerts([baseMetric({ p95Ms: 900 })], [rule], recent, now)).toHaveLength(0);
  });

  it("fires again after cooldown expires or when prior incident is resolved", () => {
    const rule = baseRule({ config: { thresholdMs: 500, cooldownMinutes: DEFAULT_COOLDOWN_MINUTES } });
    const cooled: AlertCooldownIncident[] = [
      {
        ruleId: rule.id,
        routeTemplate: "/login",
        status: "open",
        openedAt: "2026-11-04T11:00:00.000Z", // 60 min ago
      },
    ];
    expect(evaluateAlerts([baseMetric({ p95Ms: 900 })], [rule], cooled, now)).toHaveLength(1);

    const resolved: AlertCooldownIncident[] = [
      {
        ruleId: rule.id,
        routeTemplate: "/login",
        status: "resolved",
        openedAt: "2026-11-04T11:50:00.000Z",
      },
    ];
    expect(evaluateAlerts([baseMetric({ p95Ms: 900 })], [rule], resolved, now)).toHaveLength(1);
  });

  it("dedupes the same rule+route within one evaluation pass", () => {
    const proposed = evaluateAlerts(
      [baseMetric({ p95Ms: 900 }), baseMetric({ p95Ms: 950 })],
      [baseRule()],
      [],
      now,
    );
    expect(proposed).toHaveLength(1);
  });
});
