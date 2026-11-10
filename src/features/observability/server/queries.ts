import "server-only";
import { requirePlatform } from "@/lib/platform/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { isMissingSchemaError } from "@/features/platform/schemas";
import {
  emptyHistogram,
  estimatePercentile,
  getObservabilityConfig,
  LATENCY_BUCKET_MS,
  mergeHistograms,
  recordLatency,
  type LatencyHistogram,
} from "@/lib/observability";
import { getSlowMs } from "@/lib/observability/config";
import type { SpanRecord } from "@/lib/observability/request-context";
import { aggregateSpansByName, AUTH_SPAN_NAME_RE, DB_SPAN_NAME_RE } from "../analysis";
export { NO_TELEMETRY_YET } from "../constants";

export type TimeRange = { from: string; to: string };

export type OverviewMetrics = {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  slowCount: number;
  source: "metrics" | "events" | "empty";
};

export type RequestEventRow = {
  id: string;
  requestId: string;
  traceId: string;
  timestamp: string;
  environment: string;
  service: string;
  routeTemplate: string;
  method: string;
  status: number;
  durationMs: number;
  tenantId: string | null;
  userId: string | null;
  errorFingerprint: string | null;
  errorMessage: string | null;
  spans: SpanRecord[];
  attrs: Record<string, unknown>;
};

export type SlowEndpointRow = {
  routeTemplate: string;
  method: string;
  requestCount: number;
  errorCount: number;
  slowCount: number;
  avgLatencyMs: number;
  p95Ms: number;
};

export type ErrorGroupRow = {
  id: string;
  fingerprint: string;
  routeTemplate: string | null;
  status: number | null;
  messageSample: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
};

export type TraceSummary = {
  traceId: string;
  firstTimestamp: string;
  lastTimestamp: string;
  eventCount: number;
  maxDurationMs: number;
  routes: string[];
  hasError: boolean;
};

export type DbSpanAgg = {
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  errorCount: number;
  p95Ms: number;
};

export type ObservabilitySettingsView = {
  env: ReturnType<typeof getObservabilityConfig>;
  db: Record<string, Json>;
};

export type AlertRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  ruleType: string;
  config: Json;
  createdAt: string;
  updatedAt: string;
};

export type IncidentRow = {
  id: string;
  status: string;
  title: string;
  summary: string | null;
  openedAt: string;
  resolvedAt: string | null;
};

export type AlertEventRow = {
  id: string;
  ruleId: string | null;
  incidentId: string | null;
  firedAt: string;
  severity: string;
  summary: string;
};

function softFail<T>(fallback: T): T {
  return fallback;
}

function isMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (isMissingSchemaError(error)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
}

function parseSpans(raw: Json): SpanRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SpanRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const startMs = typeof o.startMs === "number" ? o.startMs : typeof o.start_ms === "number" ? o.start_ms : null;
    if (!name || startMs == null) continue;
    const endMs = typeof o.endMs === "number" ? o.endMs : typeof o.end_ms === "number" ? o.end_ms : undefined;
    const status = o.status === "error" ? "error" : "ok";
    out.push({
      name,
      startMs,
      endMs,
      status,
      attrs: o.attrs && typeof o.attrs === "object" && !Array.isArray(o.attrs) ? (o.attrs as Record<string, unknown>) : undefined,
    });
  }
  return out;
}

function parseAttrs(raw: Json): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function mapEvent(r: {
  id: string;
  request_id: string;
  trace_id: string;
  timestamp: string;
  environment: string;
  service: string;
  route_template: string;
  method: string;
  status: number;
  duration_ms: number;
  tenant_id: string | null;
  user_id: string | null;
  error_fingerprint: string | null;
  error_message: string | null;
  spans: Json;
  attrs: Json;
}): RequestEventRow {
  return {
    id: r.id,
    requestId: r.request_id,
    traceId: r.trace_id,
    timestamp: r.timestamp,
    environment: r.environment,
    service: r.service,
    routeTemplate: r.route_template,
    method: r.method,
    status: r.status,
    durationMs: r.duration_ms,
    tenantId: r.tenant_id,
    userId: r.user_id,
    errorFingerprint: r.error_fingerprint,
    errorMessage: r.error_message,
    spans: parseSpans(r.spans),
    attrs: parseAttrs(r.attrs),
  };
}

function histogramFromCounts(counts: number[] | null | undefined, sumMs: number, count: number): LatencyHistogram {
  const hist = emptyHistogram();
  hist.counts = LATENCY_BUCKET_MS.map((_, i) => Math.max(0, Math.floor(counts?.[i] ?? 0)));
  hist.sumMs = sumMs;
  hist.count = count > 0 ? count : hist.counts.reduce((a, b) => a + b, 0);
  return hist;
}

function percentileFromSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

/** Parse `from`/`to` ISO or relative `range` (1h|6h|24h|7d|30d). Defaults to last 24h. */
export function resolveTimeRange(params: { from?: string | null; to?: string | null; range?: string | null }): TimeRange {
  const now = Date.now();
  const toIso = params.to && !Number.isNaN(Date.parse(params.to)) ? new Date(params.to).toISOString() : new Date(now).toISOString();
  if (params.from && !Number.isNaN(Date.parse(params.from))) {
    return { from: new Date(params.from).toISOString(), to: toIso };
  }
  const range = (params.range ?? "24h").trim().toLowerCase();
  const ms =
    range === "1h"
      ? 3_600_000
      : range === "6h"
        ? 21_600_000
        : range === "7d"
          ? 7 * 86_400_000
          : range === "30d"
            ? 30 * 86_400_000
            : 86_400_000;
  return { from: new Date(Date.parse(toIso) - ms).toISOString(), to: toIso };
}

export async function getOverviewMetrics(range: TimeRange): Promise<OverviewMetrics> {
  await requirePlatform("platform.observability.read");
  const empty: OverviewMetrics = {
    totalRequests: 0,
    errorCount: 0,
    errorRate: 0,
    avgLatencyMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    slowCount: 0,
    source: "empty",
  };
  try {
    const admin = createSupabaseAdminClient();
    const { data: metrics, error: mErr } = await admin
      .from("observability_endpoint_metrics")
      .select("request_count, error_count, slow_count, latency_sum_ms, latency_bucket_counts")
      .gte("time_bucket", range.from)
      .lte("time_bucket", range.to)
      .limit(5000);
    if (mErr && !isMissing(mErr)) {
      /* fall through to events */
    } else if (!mErr && metrics && metrics.length > 0) {
      let totalRequests = 0;
      let errorCount = 0;
      let slowCount = 0;
      let latencySum = 0;
      let hist = emptyHistogram();
      for (const row of metrics) {
        totalRequests += Number(row.request_count) || 0;
        errorCount += Number(row.error_count) || 0;
        slowCount += Number(row.slow_count) || 0;
        latencySum += Number(row.latency_sum_ms) || 0;
        hist = mergeHistograms(
          hist,
          histogramFromCounts(row.latency_bucket_counts, Number(row.latency_sum_ms) || 0, Number(row.request_count) || 0),
        );
      }
      if (totalRequests > 0) {
        return {
          totalRequests,
          errorCount,
          errorRate: errorCount / totalRequests,
          avgLatencyMs: Math.round(latencySum / totalRequests),
          p50Ms: Math.round(estimatePercentile(hist, 50)),
          p95Ms: Math.round(estimatePercentile(hist, 95)),
          p99Ms: Math.round(estimatePercentile(hist, 99)),
          slowCount,
          source: "metrics",
        };
      }
    }

    const { data: events, error: eErr } = await admin
      .from("observability_request_events")
      .select("duration_ms, status")
      .gte("timestamp", range.from)
      .lte("timestamp", range.to)
      .order("timestamp", { ascending: false })
      .limit(2000);
    if (eErr || !events || events.length === 0) return softFail(empty);

    const durations = events.map((e) => e.duration_ms).sort((a, b) => a - b);
    const hist = emptyHistogram();
    let errorCount = 0;
    let slowCount = 0;
    let sum = 0;
    const slowMs = getSlowMs();
    for (const e of events) {
      recordLatency(hist, e.duration_ms);
      sum += e.duration_ms;
      if (e.status >= 500) errorCount += 1;
      if (e.duration_ms >= slowMs) slowCount += 1;
    }
    const n = events.length;
    return {
      totalRequests: n,
      errorCount,
      errorRate: errorCount / n,
      avgLatencyMs: Math.round(sum / n),
      p50Ms: Math.round(percentileFromSorted(durations, 50) || estimatePercentile(hist, 50)),
      p95Ms: Math.round(percentileFromSorted(durations, 95) || estimatePercentile(hist, 95)),
      p99Ms: Math.round(percentileFromSorted(durations, 99) || estimatePercentile(hist, 99)),
      slowCount,
      source: "events",
    };
  } catch {
    return softFail(empty);
  }
}

export async function listRequestEvents(opts: {
  from: string;
  to: string;
  route?: string;
  status?: number;
  limit?: number;
  cursor?: string;
}): Promise<{ rows: RequestEventRow[]; nextCursor: string | null }> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
    let q = admin
      .from("observability_request_events")
      .select(
        "id, request_id, trace_id, timestamp, environment, service, route_template, method, status, duration_ms, tenant_id, user_id, error_fingerprint, error_message, spans, attrs",
      )
      .gte("timestamp", opts.from)
      .lte("timestamp", opts.to)
      .order("timestamp", { ascending: false })
      .limit(limit + 1);
    if (opts.route) q = q.ilike("route_template", `%${opts.route}%`);
    if (opts.status != null && Number.isFinite(opts.status)) q = q.eq("status", opts.status);
    if (opts.cursor && !Number.isNaN(Date.parse(opts.cursor))) q = q.lt("timestamp", opts.cursor);

    const { data, error } = await q;
    if (error || !data) return softFail({ rows: [], nextCursor: null });
    const sliced = data.slice(0, limit);
    const rows = sliced.map(mapEvent);
    const nextCursor = data.length > limit ? (rows[rows.length - 1]?.timestamp ?? null) : null;
    return { rows, nextCursor };
  } catch {
    return softFail({ rows: [], nextCursor: null });
  }
}

export async function getRequestEvent(id: string): Promise<RequestEventRow | null> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_request_events")
      .select(
        "id, request_id, trace_id, timestamp, environment, service, route_template, method, status, duration_ms, tenant_id, user_id, error_fingerprint, error_message, spans, attrs",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return softFail(null);
    return mapEvent(data);
  } catch {
    return softFail(null);
  }
}

/** Events sharing a trace id (newest first). Empty when none. */
export async function listEventsByTrace(traceId: string, limit = 50): Promise<RequestEventRow[]> {
  await requirePlatform("platform.observability.read");
  const id = traceId.trim();
  if (!id) return softFail([]);
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_request_events")
      .select(
        "id, request_id, trace_id, timestamp, environment, service, route_template, method, status, duration_ms, tenant_id, user_id, error_fingerprint, error_message, spans, attrs",
      )
      .eq("trace_id", id)
      .order("timestamp", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));
    if (error || !data) return softFail([]);
    return data.map(mapEvent);
  } catch {
    return softFail([]);
  }
}

export async function listSlowEndpoints(range: TimeRange): Promise<SlowEndpointRow[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_endpoint_metrics")
      .select("route_template, method, request_count, error_count, slow_count, latency_sum_ms, latency_bucket_counts")
      .gte("time_bucket", range.from)
      .lte("time_bucket", range.to)
      .limit(5000);
    if (error || !data || data.length === 0) {
      // Fallback: aggregate from recent events
      const { data: events, error: eErr } = await admin
        .from("observability_request_events")
        .select("route_template, method, duration_ms, status")
        .gte("timestamp", range.from)
        .lte("timestamp", range.to)
        .order("duration_ms", { ascending: false })
        .limit(1000);
      if (eErr || !events || events.length === 0) return softFail([]);
      const map = new Map<string, { durations: number[]; errors: number; slow: number; method: string; route: string }>();
      const slowMs = getSlowMs();
      for (const e of events) {
        const key = `${e.method}|${e.route_template}`;
        let entry = map.get(key);
        if (!entry) {
          entry = { durations: [], errors: 0, slow: 0, method: e.method, route: e.route_template };
          map.set(key, entry);
        }
        entry.durations.push(e.duration_ms);
        if (e.status >= 500) entry.errors += 1;
        if (e.duration_ms >= slowMs) entry.slow += 1;
      }
      return [...map.values()]
        .map((e) => {
          const sorted = [...e.durations].sort((a, b) => a - b);
          const sum = e.durations.reduce((a, b) => a + b, 0);
          return {
            routeTemplate: e.route,
            method: e.method,
            requestCount: e.durations.length,
            errorCount: e.errors,
            slowCount: e.slow,
            avgLatencyMs: Math.round(sum / e.durations.length),
            p95Ms: Math.round(percentileFromSorted(sorted, 95)),
          };
        })
        .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs || b.slowCount - a.slowCount)
        .slice(0, 50);
    }

    const map = new Map<
      string,
      { route: string; method: string; requests: number; errors: number; slow: number; sum: number; hist: LatencyHistogram }
    >();
    for (const row of data) {
      const key = `${row.method}|${row.route_template}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          route: row.route_template,
          method: row.method,
          requests: 0,
          errors: 0,
          slow: 0,
          sum: 0,
          hist: emptyHistogram(),
        };
        map.set(key, entry);
      }
      entry.requests += Number(row.request_count) || 0;
      entry.errors += Number(row.error_count) || 0;
      entry.slow += Number(row.slow_count) || 0;
      entry.sum += Number(row.latency_sum_ms) || 0;
      entry.hist = mergeHistograms(
        entry.hist,
        histogramFromCounts(row.latency_bucket_counts, Number(row.latency_sum_ms) || 0, Number(row.request_count) || 0),
      );
    }
    return [...map.values()]
      .filter((e) => e.requests > 0)
      .map((e) => ({
        routeTemplate: e.route,
        method: e.method,
        requestCount: e.requests,
        errorCount: e.errors,
        slowCount: e.slow,
        avgLatencyMs: Math.round(e.sum / e.requests),
        p95Ms: Math.round(estimatePercentile(e.hist, 95)),
      }))
      .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs || b.slowCount - a.slowCount)
      .slice(0, 50);
  } catch {
    return softFail([]);
  }
}

export async function listErrorGroups(range: TimeRange): Promise<ErrorGroupRow[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_error_groups")
      .select("id, fingerprint, route_template, status, message_sample, first_seen_at, last_seen_at, occurrence_count")
      .gte("last_seen_at", range.from)
      .lte("last_seen_at", range.to)
      .order("last_seen_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      return data.map((r) => ({
        id: r.id,
        fingerprint: r.fingerprint,
        routeTemplate: r.route_template,
        status: r.status,
        messageSample: r.message_sample,
        firstSeenAt: r.first_seen_at,
        lastSeenAt: r.last_seen_at,
        occurrenceCount: Number(r.occurrence_count) || 0,
      }));
    }

    // Fallback: synthesize groups from request events with fingerprints
    const { data: events, error: eErr } = await admin
      .from("observability_request_events")
      .select("error_fingerprint, error_message, route_template, status, timestamp")
      .gte("timestamp", range.from)
      .lte("timestamp", range.to)
      .not("error_fingerprint", "is", null)
      .order("timestamp", { ascending: false })
      .limit(500);
    if (eErr || !events) return softFail([]);
    const map = new Map<string, ErrorGroupRow>();
    for (const e of events) {
      const fp = e.error_fingerprint;
      if (!fp) continue;
      const existing = map.get(fp);
      if (!existing) {
        map.set(fp, {
          id: fp,
          fingerprint: fp,
          routeTemplate: e.route_template,
          status: e.status,
          messageSample: e.error_message,
          firstSeenAt: e.timestamp,
          lastSeenAt: e.timestamp,
          occurrenceCount: 1,
        });
      } else {
        existing.occurrenceCount += 1;
        if (e.timestamp < existing.firstSeenAt) existing.firstSeenAt = e.timestamp;
        if (e.timestamp > existing.lastSeenAt) existing.lastSeenAt = e.timestamp;
      }
    }
    return [...map.values()].sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  } catch {
    return softFail([]);
  }
}

export async function listTraces(range: TimeRange, limit = 50): Promise<TraceSummary[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_request_events")
      .select("trace_id, timestamp, duration_ms, route_template, status")
      .gte("timestamp", range.from)
      .lte("timestamp", range.to)
      .order("timestamp", { ascending: false })
      .limit(1000);
    if (error || !data) return softFail([]);
    const map = new Map<string, TraceSummary>();
    for (const e of data) {
      let t = map.get(e.trace_id);
      if (!t) {
        t = {
          traceId: e.trace_id,
          firstTimestamp: e.timestamp,
          lastTimestamp: e.timestamp,
          eventCount: 0,
          maxDurationMs: 0,
          routes: [],
          hasError: false,
        };
        map.set(e.trace_id, t);
      }
      t.eventCount += 1;
      t.maxDurationMs = Math.max(t.maxDurationMs, e.duration_ms);
      if (e.timestamp < t.firstTimestamp) t.firstTimestamp = e.timestamp;
      if (e.timestamp > t.lastTimestamp) t.lastTimestamp = e.timestamp;
      if (!t.routes.includes(e.route_template)) t.routes.push(e.route_template);
      if (e.status >= 500) t.hasError = true;
    }
    return [...map.values()].sort((a, b) => Date.parse(b.lastTimestamp) - Date.parse(a.lastTimestamp)).slice(0, limit);
  } catch {
    return softFail([]);
  }
}

/**
 * Aggregate spans from recent request-event jsonb.
 * `kind: "db"` keeps names containing `db.` / `supabase.` / `rpc` (see OBSERVABILITY.md —
 * pg_stat_statements is optional ops, not wired here).
 * `kind: "auth"` keeps login-path spans (session.getClaims, sign_in.*, …).
 * `kind: "all"` keeps every span name.
 */
export async function listSpanAggregates(
  range: TimeRange,
  kind: "db" | "auth" | "all" = "all",
): Promise<DbSpanAgg[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_request_events")
      .select("spans")
      .gte("timestamp", range.from)
      .lte("timestamp", range.to)
      .order("timestamp", { ascending: false })
      .limit(500);
    if (error || !data) return softFail([]);
    const filter = kind === "db" ? DB_SPAN_NAME_RE : kind === "auth" ? AUTH_SPAN_NAME_RE : undefined;
    const aggs = aggregateSpansByName(
      data.map((row) => parseSpans(row.spans)),
      filter,
    );
    return aggs.map((a) => ({
      name: a.name,
      count: a.count,
      avgMs: a.avgMs,
      maxMs: a.maxMs,
      errorCount: a.errorCount,
      p95Ms: a.p95Ms,
    }));
  } catch {
    return softFail([]);
  }
}

/** @deprecated Prefer listSpanAggregates(range, "db"). */
export async function listDatabaseSpanAggregates(range: TimeRange): Promise<DbSpanAgg[]> {
  return listSpanAggregates(range, "db");
}

export async function listAlertRules(): Promise<AlertRuleRow[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_alert_rules")
      .select("id, name, enabled, rule_type, config, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error || !data) return softFail([]);
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      ruleType: r.rule_type,
      config: r.config,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return softFail([]);
  }
}

export async function listIncidents(): Promise<IncidentRow[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_incidents")
      .select("id, status, title, summary, opened_at, resolved_at")
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error || !data) return softFail([]);
    return data.map((r) => ({
      id: r.id,
      status: r.status,
      title: r.title,
      summary: r.summary,
      openedAt: r.opened_at,
      resolvedAt: r.resolved_at,
    }));
  } catch {
    return softFail([]);
  }
}

export async function listAlertEvents(limit = 50): Promise<AlertEventRow[]> {
  await requirePlatform("platform.observability.read");
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("observability_alert_events")
      .select("id, rule_id, incident_id, fired_at, severity, summary")
      .order("fired_at", { ascending: false })
      .limit(limit);
    if (error || !data) return softFail([]);
    return data.map((r) => ({
      id: r.id,
      ruleId: r.rule_id,
      incidentId: r.incident_id,
      firedAt: r.fired_at,
      severity: r.severity,
      summary: r.summary,
    }));
  } catch {
    return softFail([]);
  }
}

export async function getObservabilitySettings(): Promise<ObservabilitySettingsView> {
  await requirePlatform("platform.observability.read");
  const env = getObservabilityConfig();
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("observability_settings").select("key, value");
    if (error || !data) return softFail({ env, db: {} });
    const db: Record<string, Json> = {};
    for (const row of data) db[row.key] = row.value;
    return { env, db };
  } catch {
    return softFail({ env, db: {} });
  }
}

export async function updateObservabilitySetting(key: string, value: Json): Promise<{ ok: boolean; error?: string }> {
  await requirePlatform("platform.observability.manage");
  const safeKey = key.trim().slice(0, 120);
  if (!safeKey) return { ok: false, error: "Invalid key" };
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("observability_settings").upsert(
      { key: safeKey, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) return { ok: false, error: isMissing(error) ? "Observability tables not migrated yet." : error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}
