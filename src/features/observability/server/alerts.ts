import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/supabase/errors";
import { requirePlatform } from "@/lib/platform/access";
import type { Json } from "@/lib/supabase/database.types";
import { mergeEndpointMetrics } from "../analysis";
import {
  evaluateAlerts,
  type AlertCooldownIncident,
  type AlertMetricSnapshot,
  type AlertRuleConfig,
  type AlertRuleForEval,
  type ProposedIncident,
} from "../alert-evaluation";

export {
  DEFAULT_COOLDOWN_MINUTES,
  errorRate,
  evaluateAlerts,
  p95FromHistogram,
  type AlertCooldownIncident,
  type AlertMetricSnapshot,
  type AlertRuleConfig,
  type AlertRuleForEval,
  type AlertSeverity,
  type ProposedIncident,
} from "../alert-evaluation";

export type EvaluateAlertsOptions = {
  /**
   * Skip requirePlatform — for cron / service_role paths with no user session.
   * Admin UI callers must leave this unset/false.
   */
  skipAuth?: boolean;
};

type PgError = Parameters<typeof mapDbError>[0];
function check(error: PgError, context?: Record<string, unknown>) {
  if (error) throw mapDbError(error, context);
}

export type AlertRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  ruleType: string;
  config: AlertRuleConfig;
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
  details: Record<string, unknown>;
};

function asConfig(value: Json): AlertRuleConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AlertRuleConfig;
}

function asDetails(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** List alert rules. Admin client after platform.observability.manage (RLS deny-all). */
export async function listAlertRules(): Promise<AlertRuleRow[]> {
  await requirePlatform("platform.observability.manage");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("observability_alert_rules").select("*").order("created_at", { ascending: true });
  check(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    ruleType: r.rule_type,
    config: asConfig(r.config),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** List recent incidents (newest first). */
export async function listIncidents(limit = 50): Promise<IncidentRow[]> {
  await requirePlatform("platform.observability.manage");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("observability_incidents")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  check(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    title: r.title,
    summary: r.summary,
    openedAt: r.opened_at,
    resolvedAt: r.resolved_at,
    details: asDetails(r.details),
  }));
}

const toggleRuleSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
});

/** Enable or disable an alert rule. */
export async function toggleAlertRule(input: z.infer<typeof toggleRuleSchema>): Promise<AlertRuleRow> {
  await requirePlatform("platform.observability.manage");
  const { id, enabled } = toggleRuleSchema.parse(input);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("observability_alert_rules")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  check(error, { ruleId: id });
  if (!data) throw mapDbError({ code: "PGRST116", message: "rule not found" }, { ruleId: id });
  return {
    id: data.id,
    name: data.name,
    enabled: data.enabled,
    ruleType: data.rule_type,
    config: asConfig(data.config),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

const acknowledgeSchema = z.object({
  incidentId: z.string().uuid(),
});

/** Mark an open incident as acknowledged. */
export async function acknowledgeIncident(input: z.infer<typeof acknowledgeSchema>): Promise<IncidentRow> {
  await requirePlatform("platform.observability.manage");
  const { incidentId } = acknowledgeSchema.parse(input);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("observability_incidents")
    .update({ status: "acknowledged" })
    .eq("id", incidentId)
    .in("status", ["open", "acknowledged"])
    .select("*")
    .maybeSingle();
  check(error, { incidentId });
  if (!data) throw mapDbError({ code: "PGRST116", message: "incident not found" }, { incidentId });
  return {
    id: data.id,
    status: data.status,
    title: data.title,
    summary: data.summary,
    openedAt: data.opened_at,
    resolvedAt: data.resolved_at,
    details: asDetails(data.details),
  };
}

const upsertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  ruleType: z.enum(["p95", "error_rate", "p95_or_error_rate"]),
  config: z
    .object({
      thresholdMs: z.number().positive().optional(),
      thresholdRate: z.number().min(0).max(1).optional(),
      routeTemplate: z.string().max(300).nullable().optional(),
      cooldownMinutes: z.number().int().min(0).max(24 * 60).optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      minRequests: z.number().int().min(1).optional(),
    })
    .default({}),
});

/** Insert or update an alert rule. */
export async function upsertAlertRule(input: z.infer<typeof upsertRuleSchema>): Promise<AlertRuleRow> {
  await requirePlatform("platform.observability.manage");
  const parsed = upsertRuleSchema.parse(input);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const row = {
    name: parsed.name,
    enabled: parsed.enabled,
    rule_type: parsed.ruleType,
    config: parsed.config as Json,
    updated_at: now,
  };

  if (parsed.id) {
    const { data, error } = await admin.from("observability_alert_rules").update(row).eq("id", parsed.id).select("*").maybeSingle();
    check(error, { ruleId: parsed.id });
    if (!data) throw mapDbError({ code: "PGRST116", message: "rule not found" }, { ruleId: parsed.id });
    return {
      id: data.id,
      name: data.name,
      enabled: data.enabled,
      ruleType: data.rule_type,
      config: asConfig(data.config),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  const { data, error } = await admin.from("observability_alert_rules").insert(row).select("*").single();
  check(error);
  if (!data) throw mapDbError({ code: "PGRST116", message: "rule insert returned no row" });
  return {
    id: data.id,
    name: data.name,
    enabled: data.enabled,
    ruleType: data.rule_type,
    config: asConfig(data.config),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Evaluate rules against metrics and optionally persist proposed incidents.
 * Pure check: call `evaluateAlerts` alone. This helper loads cooldown state from DB.
 *
 * Pass `{ skipAuth: true }` only from cron/service paths (no user session).
 */
export async function evaluateAndRecordAlerts(
  metrics: readonly AlertMetricSnapshot[],
  rules?: readonly AlertRuleForEval[],
  options?: EvaluateAlertsOptions,
): Promise<ProposedIncident[]> {
  if (!options?.skipAuth) {
    await requirePlatform("platform.observability.manage");
  }
  const admin = createSupabaseAdminClient();

  let ruleList: AlertRuleForEval[];
  if (rules) {
    ruleList = [...rules];
  } else {
    const { data, error } = await admin.from("observability_alert_rules").select("*").eq("enabled", true);
    check(error);
    ruleList = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      ruleType: r.rule_type,
      config: asConfig(r.config),
    }));
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: incidents, error: incErr } = await admin
    .from("observability_incidents")
    .select("id, status, opened_at, details")
    .in("status", ["open", "acknowledged"])
    .gte("opened_at", since);
  check(incErr);

  const recent: AlertCooldownIncident[] = (incidents ?? []).map((inc) => {
    const details = asDetails(inc.details);
    return {
      ruleId: typeof details.ruleId === "string" ? details.ruleId : null,
      routeTemplate: typeof details.routeTemplate === "string" ? details.routeTemplate : null,
      status: inc.status,
      openedAt: inc.opened_at,
    };
  });

  const proposed = evaluateAlerts(metrics, ruleList, recent);

  for (const p of proposed) {
    const { data: incident, error: createErr } = await admin
      .from("observability_incidents")
      .insert({
        status: "open",
        title: p.title.slice(0, 200),
        summary: p.summary.slice(0, 1000),
        details: { ...p.details, ruleId: p.ruleId } as Json,
      })
      .select("id")
      .single();
    check(createErr);
    if (!incident) continue;
    const { error: eventErr } = await admin.from("observability_alert_events").insert({
      rule_id: p.ruleId,
      incident_id: incident.id,
      severity: p.severity,
      summary: p.summary.slice(0, 500),
      details: p.details as Json,
    });
    check(eventErr);
  }

  return proposed;
}

const DEFAULT_CRON_WINDOW_MINUTES = 15;

/**
 * Cron-safe alert evaluation: load recent endpoint metrics (admin client) and
 * record incidents without requirePlatform.
 */
export async function evaluateAndRecordAlertsForCron(
  windowMinutes = DEFAULT_CRON_WINDOW_MINUTES,
): Promise<ProposedIncident[]> {
  const admin = createSupabaseAdminClient();
  const from = new Date(Date.now() - Math.max(1, windowMinutes) * 60_000).toISOString();
  const { data, error } = await admin
    .from("observability_endpoint_metrics")
    .select("route_template, method, request_count, error_count, latency_bucket_counts, latency_sum_ms")
    .gte("time_bucket", from)
    .limit(5000);
  check(error);

  const snapshots = mergeEndpointMetrics(
    (data ?? []).map((row) => ({
      route_template: row.route_template,
      method: row.method,
      request_count: Number(row.request_count) || 0,
      error_count: Number(row.error_count) || 0,
      latency_bucket_counts: row.latency_bucket_counts?.map((n) => Number(n) || 0) ?? null,
      latency_sum_ms: Number(row.latency_sum_ms) || 0,
    })),
    true,
  );

  return evaluateAndRecordAlerts(snapshots, undefined, { skipAuth: true });
}
