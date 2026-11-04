/**
 * Pure alert evaluation (no I/O). Unit-tested in tests/unit/observability/alerts.test.ts.
 * Persisting incidents is the caller's job after requirePlatform / cron auth.
 */

import { estimatePercentile, type LatencyHistogram } from "@/lib/observability/metrics";

export type AlertSeverity = "info" | "warning" | "critical";

/** Metric snapshot ready for threshold checks (one route/method window). */
export type AlertMetricSnapshot = {
  routeTemplate: string;
  method?: string;
  requestCount: number;
  errorCount: number;
  /** Precomputed p95 latency in ms (0 when empty). */
  p95Ms: number;
};

export type AlertRuleConfig = {
  /** Fire when p95 exceeds this (ms). */
  thresholdMs?: number;
  /** Fire when errorCount/requestCount exceeds this (0–1). */
  thresholdRate?: number;
  /** Limit to one route; omit/null = every metric row. */
  routeTemplate?: string | null;
  /** Skip new incidents if one for the same rule+route is still cooling down. */
  cooldownMinutes?: number;
  severity?: AlertSeverity;
  /** Ignore error_rate when requestCount is below this (default 1). */
  minRequests?: number;
};

export type AlertRuleForEval = {
  id: string;
  name: string;
  enabled: boolean;
  /** `p95` | `error_rate` | `p95_or_error_rate` */
  ruleType: string;
  config: AlertRuleConfig;
};

/** Open/recent incidents used only for cooldown gating. */
export type AlertCooldownIncident = {
  ruleId: string | null;
  routeTemplate?: string | null;
  status: string;
  openedAt: string;
};

export type ProposedIncident = {
  ruleId: string;
  title: string;
  summary: string;
  severity: AlertSeverity;
  details: {
    ruleType: string;
    routeTemplate: string;
    method?: string;
    p95Ms: number;
    errorRate: number;
    requestCount: number;
    errorCount: number;
    thresholdMs?: number;
    thresholdRate?: number;
  };
};

export const DEFAULT_COOLDOWN_MINUTES = 30;

export function errorRate(requestCount: number, errorCount: number): number {
  if (!(requestCount > 0)) return 0;
  return Math.max(0, errorCount) / requestCount;
}

/** p95 from a latency histogram (bucket counts). */
export function p95FromHistogram(histogram: LatencyHistogram): number {
  return estimatePercentile(histogram, 95);
}

function parseSeverity(value: unknown): AlertSeverity {
  return value === "info" || value === "critical" || value === "warning" ? value : "warning";
}

function matchesRoute(rule: AlertRuleForEval, routeTemplate: string): boolean {
  const want = rule.config.routeTemplate;
  if (want == null || want === "") return true;
  return want === routeTemplate;
}

function inCooldown(
  ruleId: string,
  routeTemplate: string,
  recent: readonly AlertCooldownIncident[],
  cooldownMinutes: number,
  now: Date,
): boolean {
  if (cooldownMinutes <= 0) return false;
  const cutoff = now.getTime() - cooldownMinutes * 60_000;
  return recent.some((inc) => {
    if (inc.ruleId !== ruleId) return false;
    if (inc.status === "resolved") return false;
    if (inc.routeTemplate != null && inc.routeTemplate !== "" && inc.routeTemplate !== routeTemplate) return false;
    const opened = Date.parse(inc.openedAt);
    if (!Number.isFinite(opened)) return false;
    return opened >= cutoff;
  });
}

function breaches(rule: AlertRuleForEval, metric: AlertMetricSnapshot): { p95: boolean; errorRate: boolean } {
  const cfg = rule.config;
  const rate = errorRate(metric.requestCount, metric.errorCount);
  const minRequests = cfg.minRequests ?? 1;
  const p95Hit = cfg.thresholdMs != null && metric.p95Ms > cfg.thresholdMs;
  const errHit =
    cfg.thresholdRate != null && metric.requestCount >= minRequests && rate > cfg.thresholdRate;

  switch (rule.ruleType) {
    case "p95":
      return { p95: p95Hit, errorRate: false };
    case "error_rate":
      return { p95: false, errorRate: errHit };
    case "p95_or_error_rate":
      return { p95: p95Hit, errorRate: errHit };
    default:
      // Unknown types: treat as combined when either threshold is configured.
      return { p95: p95Hit, errorRate: errHit };
  }
}

/**
 * For each enabled rule and matching metric, propose an incident when p95 and/or
 * error rate exceeds the rule — unless a non-resolved incident for that rule+route
 * is still within the cooldown window.
 */
export function evaluateAlerts(
  metrics: readonly AlertMetricSnapshot[],
  rules: readonly AlertRuleForEval[],
  recentIncidents: readonly AlertCooldownIncident[] = [],
  now: Date = new Date(),
): ProposedIncident[] {
  const out: ProposedIncident[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const cooldown = rule.config.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
    const severity = parseSeverity(rule.config.severity);

    for (const metric of metrics) {
      if (!matchesRoute(rule, metric.routeTemplate)) continue;
      const hit = breaches(rule, metric);
      if (!hit.p95 && !hit.errorRate) continue;
      if (inCooldown(rule.id, metric.routeTemplate, recentIncidents, cooldown, now)) continue;

      const key = `${rule.id}::${metric.routeTemplate}::${metric.method ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const rate = errorRate(metric.requestCount, metric.errorCount);
      const parts: string[] = [];
      if (hit.p95) parts.push(`p95 ${Math.round(metric.p95Ms)}ms > ${rule.config.thresholdMs}ms`);
      if (hit.errorRate) parts.push(`error rate ${(rate * 100).toFixed(1)}% > ${((rule.config.thresholdRate ?? 0) * 100).toFixed(1)}%`);

      out.push({
        ruleId: rule.id,
        title: `${rule.name}: ${metric.routeTemplate}`,
        summary: parts.join("; ") || rule.name,
        severity,
        details: {
          ruleType: rule.ruleType,
          routeTemplate: metric.routeTemplate,
          method: metric.method,
          p95Ms: metric.p95Ms,
          errorRate: rate,
          requestCount: metric.requestCount,
          errorCount: metric.errorCount,
          thresholdMs: rule.config.thresholdMs,
          thresholdRate: rule.config.thresholdRate,
        },
      });
    }
  }

  return out;
}
