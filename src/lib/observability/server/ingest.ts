import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "../logger";
import type { BufferedEndpointMetric, BufferedRequestEvent } from "./types";

/**
 * Persist buffered observability rows via the admin client (ADR-006: background
 * telemetry). Never throws to callers — failures are logged with warn.
 *
 * App UI reads these tables via the same admin client after requirePlatform
 * (platform.observability.read); RLS denies anon/authenticated.
 */
export async function ingestObservability(events: BufferedRequestEvent[], metrics: BufferedEndpointMetric[]): Promise<void> {
  try {
    if (events.length === 0 && metrics.length === 0) return;
    const admin = createSupabaseAdminClient();

    if (events.length > 0) {
      const { error } = await admin.from("observability_request_events").insert(
        events.map((e) => ({
          request_id: e.request_id,
          trace_id: e.trace_id,
          timestamp: e.timestamp,
          environment: e.environment,
          service: e.service,
          route_template: e.route_template,
          method: e.method,
          status: e.status,
          duration_ms: e.duration_ms,
          tenant_id: e.tenant_id,
          user_id: e.user_id,
          error_fingerprint: e.error_fingerprint,
          error_message: e.error_message,
          spans: e.spans as never,
          attrs: e.attrs as never,
        })),
      );
      if (error) logger.warn("observability.insert_events_failed", { error: error.message, count: events.length });
    }

    if (metrics.length > 0) {
      const { error } = await admin.rpc("observability_upsert_endpoint_metrics", {
        p_rows: metrics.map((m) => ({
          time_bucket: m.time_bucket,
          environment: m.environment,
          service: m.service,
          route_template: m.route_template,
          method: m.method,
          request_count: m.request_count,
          error_count: m.error_count,
          slow_count: m.slow_count,
          latency_sum_ms: m.latency_sum_ms,
          latency_bucket_counts: m.latency_bucket_counts,
        })),
      });
      if (error) logger.warn("observability.upsert_metrics_failed", { error: error.message, count: metrics.length });
    }
  } catch (err) {
    logger.warn("observability.ingest_failed", { error: err });
  }
}
