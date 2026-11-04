import "server-only";
import { after } from "next/server";
import { isObservabilityEnabled, getSlowMs } from "../config";
import { emptyHistogram, histogramCountsForDb, recordLatency, type LatencyHistogram } from "../metrics";
import { getRequestContext, generateId } from "../request-context";
import { normalizeRoute, redactValue } from "../sanitization";
import { shouldSample } from "../sampling";
import { logger } from "../logger";
import { ingestObservability } from "./ingest";
import type { BufferedEndpointMetric, BufferedRequestEvent } from "./types";

export type { BufferedEndpointMetric, BufferedRequestEvent };

export type RequestEventPartial = {
  requestId?: string;
  traceId?: string;
  timestamp?: string | Date;
  environment?: string;
  service?: string;
  route?: string;
  routeTemplate?: string;
  method?: string;
  status: number;
  durationMs: number;
  tenantId?: string | null;
  userId?: string | null;
  errorFingerprint?: string | null;
  errorMessage?: string | null;
  spans?: unknown;
  attrs?: Record<string, unknown>;
  forceSample?: boolean;
};

type BufferState = {
  events: BufferedRequestEvent[];
  metrics: Map<string, { row: BufferedEndpointMetric; hist: LatencyHistogram }>;
  flushScheduled: boolean;
};

const MAX_BUFFERED_EVENTS = 200;

const state: BufferState = {
  events: [],
  metrics: new Map(),
  flushScheduled: false,
};

function environmentName(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function minuteBucket(iso: string): string {
  const d = new Date(iso);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}

function metricKey(m: Pick<BufferedEndpointMetric, "time_bucket" | "environment" | "service" | "route_template" | "method">): string {
  return `${m.time_bucket}|${m.environment}|${m.service}|${m.route_template}|${m.method}`;
}

async function flushObservabilityBuffer(): Promise<void> {
  try {
    const { events, metrics } = takeObservabilityBuffer();
    if (events.length === 0 && metrics.length === 0) return;
    await ingestObservability(events, metrics);
  } catch (err) {
    logger.warn("observability.ingest_failed", { error: err });
  }
}

function scheduleFlush(): void {
  if (state.flushScheduled) return;
  state.flushScheduled = true;
  const run = () => {
    state.flushScheduled = false;
    void flushObservabilityBuffer().catch((err) => {
      logger.warn("observability.flush_failed", { error: err });
    });
  };
  try {
    after(run);
  } catch {
    // Outside a Next.js request (scripts/tests): flush on next tick.
    setTimeout(run, 0);
  }
}

/** Test/helper: drain a copy of the in-memory buffer without writing. */
export function __peekObservabilityBuffer(): { events: BufferedRequestEvent[]; metrics: BufferedEndpointMetric[] } {
  return {
    events: [...state.events],
    metrics: [...state.metrics.values()].map((m) => ({
      ...m.row,
      latency_bucket_counts: histogramCountsForDb(m.hist),
      latency_sum_ms: m.hist.sumMs,
    })),
  };
}

/** Test helper: clear buffer. */
export function __resetObservabilityBuffer(): void {
  state.events = [];
  state.metrics.clear();
  state.flushScheduled = false;
}

/** Take ownership of buffered rows for ingest (empties the buffer). */
export function takeObservabilityBuffer(): { events: BufferedRequestEvent[]; metrics: BufferedEndpointMetric[] } {
  const events = state.events;
  const metrics = [...state.metrics.values()].map((m) => ({
    ...m.row,
    latency_bucket_counts: histogramCountsForDb(m.hist),
    latency_sum_ms: Math.round(m.hist.sumMs),
  }));
  state.events = [];
  state.metrics.clear();
  return { events, metrics };
}

/**
 * Buffer a request event + roll it into endpoint metrics. Never throws.
 * No-ops when observability is disabled (unless forceSample).
 */
export function recordRequestEvent(partial: RequestEventPartial): void {
  try {
    if (!isObservabilityEnabled() && !partial.forceSample) return;

    const ctx = getRequestContext();
    const routeRaw = partial.routeTemplate ?? partial.route ?? ctx?.route ?? "/";
    const routeTemplate = normalizeRoute(routeRaw);
    const status = partial.status;
    const durationMs = Math.max(0, Math.round(partial.durationMs));
    const method = (partial.method ?? ctx?.method ?? "GET").toUpperCase();

    if (
      !shouldSample({
        route: routeTemplate,
        status,
        durationMs,
        force: partial.forceSample,
      })
    ) {
      return;
    }

    const timestamp = partial.timestamp
      ? typeof partial.timestamp === "string"
        ? partial.timestamp
        : partial.timestamp.toISOString()
      : new Date().toISOString();

    const requestId = partial.requestId ?? ctx?.requestId ?? generateId();
    const traceId = partial.traceId ?? ctx?.traceId ?? requestId;
    const environment = partial.environment ?? environmentName();
    const service = partial.service ?? "web";
    const spans = partial.spans ?? ctx?.spans ?? [];
    const attrs = (redactValue({ ...(ctx?.attrs ?? {}), ...(partial.attrs ?? {}) }) as Record<string, unknown>) ?? {};

    const event: BufferedRequestEvent = {
      request_id: requestId,
      trace_id: traceId,
      timestamp,
      environment,
      service,
      route_template: routeTemplate,
      method,
      status,
      duration_ms: durationMs,
      tenant_id: partial.tenantId ?? ctx?.tenantId ?? null,
      user_id: partial.userId ?? null,
      error_fingerprint: partial.errorFingerprint ?? null,
      error_message: partial.errorMessage ? String(partial.errorMessage).slice(0, 500) : null,
      spans,
      attrs,
    };

    state.events.push(event);
    if (state.events.length > MAX_BUFFERED_EVENTS) {
      state.events.splice(0, state.events.length - MAX_BUFFERED_EVENTS);
    }

    const bucket = minuteBucket(timestamp);
    const key = metricKey({
      time_bucket: bucket,
      environment,
      service,
      route_template: routeTemplate,
      method,
    });
    let entry = state.metrics.get(key);
    if (!entry) {
      entry = {
        hist: emptyHistogram(),
        row: {
          time_bucket: bucket,
          environment,
          service,
          route_template: routeTemplate,
          method,
          request_count: 0,
          error_count: 0,
          slow_count: 0,
          latency_sum_ms: 0,
          latency_bucket_counts: [],
        },
      };
      state.metrics.set(key, entry);
    }
    entry.row.request_count += 1;
    if (status >= 500) entry.row.error_count += 1;
    if (durationMs >= getSlowMs()) entry.row.slow_count += 1;
    recordLatency(entry.hist, durationMs);

    scheduleFlush();
  } catch (err) {
    logger.warn("observability.record_failed", { error: err });
  }
}

export { flushObservabilityBuffer };
