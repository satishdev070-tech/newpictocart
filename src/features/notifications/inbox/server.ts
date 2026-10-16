import "server-only";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import type { Json } from "@/lib/supabase/database.types";
import type { PlatformPermission } from "@/lib/permissions/matrix";
import { NOTIFICATION_TYPES, typesInGroup, type NotificationGroup, type NotificationItem, type NotificationScope, type NotificationType } from "./catalog";

/**
 * Reads and read-state writes for the bell. Always the user's session client (RLS: own rows while
 * still a member) plus explicit user/scope/tenant filters. The audience is resolved on the server:
 * dashboard → the active membership's tenant, console → platform staff. Never from the request.
 */
export type InboxAudience = { userId: string; scope: "tenant"; tenantId: string } | { userId: string; scope: "platform"; tenantId: null };

const COLUMNS = "id, type, title, body, link, read_at, created_at";

type Row = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
const toItem = (r: Row): NotificationItem => ({ id: r.id, type: r.type, title: r.title, body: r.body, link: r.link, readAt: r.read_at, createdAt: r.created_at });

// Supabase builders are generic-heavy; this keeps the audience filter in one place.
function scoped<Q extends { eq(column: string, value: string): Q; is(column: string, value: null): Q }>(q: Q, a: InboxAudience): Q {
  const base = q.eq("user_id", a.userId).eq("scope", a.scope);
  return a.tenantId ? base.eq("tenant_id", a.tenantId) : base.is("tenant_id", null);
}

export type BellData = { unread: number; items: NotificationItem[] };

/** Unread count + the latest few, for the header bell. Never throws (the bell must not break the shell). */
export async function getBellData(a: InboxAudience, limit = 8): Promise<BellData> {
  try {
    const supabase = await createSupabaseServerClient();
    const [count, latest] = await Promise.all([
      scoped(supabase.from("notifications").select("id", { count: "exact", head: true }), a).is("read_at", null),
      scoped(supabase.from("notifications").select(COLUMNS), a).order("created_at", { ascending: false }).limit(limit),
    ]);
    if (count.error || latest.error) throw count.error ?? latest.error;
    return { unread: count.count ?? 0, items: (latest.data ?? []).map(toItem) };
  } catch (err) {
    logger.warn("notifications.bell_failed", { scope: a.scope, error: err });
    return { unread: 0, items: [] };
  }
}

export type ListFilter = { status: "all" | "unread"; group: NotificationGroup | null; page: number; pageSize: number };

export async function listNotifications(a: InboxAudience, f: ListFilter): Promise<{ items: NotificationItem[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let q = scoped(supabase.from("notifications").select(COLUMNS, { count: "exact" }), a);
  if (f.status === "unread") q = q.is("read_at", null);
  if (f.group) q = q.in("type", typesInGroup(f.group));
  const from = (f.page - 1) * f.pageSize;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + f.pageSize - 1);
  if (error) throw new AppError("INTERNAL", { context: { op: "notifications.list", code: error.code } });
  return { items: (data ?? []).map(toItem), total: count ?? 0 };
}

/** Marks some (ids) or all unread notifications of this audience as read. Returns rows changed. */
export async function markRead(a: InboxAudience, ids: string[] | "all"): Promise<number> {
  const supabase = await createSupabaseServerClient();
  let q = scoped(supabase.from("notifications").update({ read_at: new Date().toISOString() }), a).is("read_at", null);
  if (ids !== "all") q = q.in("id", ids);
  const { data, error } = await q.select("id");
  if (error) throw new AppError("INTERNAL", { context: { op: "notifications.markRead", code: error.code } });
  return data?.length ?? 0;
}

export async function markUnread(a: InboxAudience, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await scoped(supabase.from("notifications").update({ read_at: null }), a).eq("id", id);
  if (error) throw new AppError("INTERNAL", { context: { op: "notifications.markUnread", code: error.code } });
}

export async function getMutedTypes(userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("notification_preferences").select("muted_types").eq("user_id", userId).maybeSingle();
  return data?.muted_types ?? [];
}

/**
 * Saves the muted types of ONE scope; the other scope's mutes are kept (a seller who is also
 * platform staff has one row).
 */
export async function saveMutedTypes(userId: string, scope: NotificationScope, muted: NotificationType[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const current = await getMutedTypes(userId);
  const keep = current.filter((t) => (NOTIFICATION_TYPES as Record<string, { scope: string }>)[t]?.scope !== scope);
  const muted_types = [...new Set([...keep, ...muted.filter((t) => NOTIFICATION_TYPES[t].scope === scope)])];
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, muted_types, updated_at: new Date().toISOString() });
  if (error) throw new AppError("INTERNAL", { context: { op: "notifications.savePreferences", code: error.code } });
}

/**
 * Platform events without a table of their own (APK requests, disputes, payout failures). Callers
 * must have verified the event first (webhook signature or platform permission check); ADR-006
 * covers the secret-key client for verified webhooks and platform ops. Never throws.
 */
export async function notifyPlatform(args: { permission: PlatformPermission; type: Extract<NotificationType, `platform.${string}`>; title: string; body?: string; link?: string; data?: Record<string, Json>; dedupeKey?: string }): Promise<number> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("notify_platform_event", {
      p_perm: args.permission,
      p_type: args.type,
      p_title: args.title,
      p_body: args.body ?? "",
      p_link: args.link ?? "/admin",
      p_data: (args.data ?? {}) as Json,
      p_dedupe: args.dedupeKey ?? `${args.type}:${crypto.randomUUID()}`,
    });
    if (error) throw error;
    return data ?? 0;
  } catch (err) {
    logger.error("notifications.notify_platform_failed", { type: args.type, error: err });
    return 0;
  }
}

/** Cron (service role): trial-ending reminders and retention. */
export async function runNotificationReminders(): Promise<Json> {
  const { data, error } = await createSupabaseAdminClient().rpc("notifications_run_reminders");
  if (error) throw error;
  return data;
}
