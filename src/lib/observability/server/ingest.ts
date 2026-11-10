import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "../logger";
import type { BufferedEndpointMetric, BufferedRequestEvent } from "./types";

type ErrorGroupAgg = {
  fingerprint: string;
  routeTemplate: string | null;
  status: number | null;
  messageSample: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
};

/** Aggregate fingerprinted events for error-group upsert (pure; exported for tests). */
export function aggregateErrorGroups(events: readonly BufferedRequestEvent[]): ErrorGroupAgg[] {
  const map = new Map<string, ErrorGroupAgg>();
  for (const e of events) {
    const fp = e.error_fingerprint?.trim();
    if (!fp) continue;
    const existing = map.get(fp);
    if (!existing) {
      map.set(fp, {
        fingerprint: fp.slice(0, 128),
        routeTemplate: e.route_template || null,
        status: e.status,
        messageSample: e.error_message ? e.error_message.slice(0, 500) : null,
        firstSeenAt: e.timestamp,
        lastSeenAt: e.timestamp,
        count: 1,
      });
      continue;
    }
    existing.count += 1;
    if (e.timestamp < existing.firstSeenAt) existing.firstSeenAt = e.timestamp;
    if (e.timestamp > existing.lastSeenAt) {
      existing.lastSeenAt = e.timestamp;
      if (e.error_message) existing.messageSample = e.error_message.slice(0, 500);
    }
  }
  return [...map.values()];
}

async function upsertErrorGroups(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  events: readonly BufferedRequestEvent[],
): Promise<void> {
  const groups = aggregateErrorGroups(events);
  if (groups.length === 0) return;

  for (const g of groups) {
    try {
      const { data: existing, error: readErr } = await admin
        .from("observability_error_groups")
        .select("id, occurrence_count, first_seen_at, message_sample")
        .eq("fingerprint", g.fingerprint)
        .maybeSingle();
      if (readErr) {
        logger.warn("observability.error_group_read_failed", { error: readErr.message, fingerprint: g.fingerprint });
        continue;
      }

      if (existing) {
        const firstSeen =
          existing.first_seen_at && existing.first_seen_at < g.firstSeenAt ? existing.first_seen_at : g.firstSeenAt;
        const { error: updErr } = await admin
          .from("observability_error_groups")
          .update({
            last_seen_at: g.lastSeenAt,
            first_seen_at: firstSeen,
            occurrence_count: (Number(existing.occurrence_count) || 0) + g.count,
            route_template: g.routeTemplate,
            status: g.status,
            message_sample: g.messageSample ?? existing.message_sample,
          })
          .eq("fingerprint", g.fingerprint);
        if (updErr) logger.warn("observability.error_group_update_failed", { error: updErr.message, fingerprint: g.fingerprint });
      } else {
        const { error: insErr } = await admin.from("observability_error_groups").insert({
          fingerprint: g.fingerprint,
          route_template: g.routeTemplate,
          status: g.status,
          message_sample: g.messageSample,
          first_seen_at: g.firstSeenAt,
          last_seen_at: g.lastSeenAt,
          occurrence_count: g.count,
          attrs: {},
        });
        if (insErr) logger.warn("observability.error_group_insert_failed", { error: insErr.message, fingerprint: g.fingerprint });
      }
    } catch (err) {
      logger.warn("observability.error_group_upsert_failed", { error: err, fingerprint: g.fingerprint });
    }
  }
}

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
      else await upsertErrorGroups(admin, events);
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
