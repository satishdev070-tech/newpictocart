import "server-only";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import type { TenantContext } from "@/lib/tenant/membership";
import type { AssistantLocale } from "../languages";
import { isAssistantLocale } from "../languages";
import type { AssistantHistoryItem } from "../prompt";
import { THEME_COLOR_TOKENS, type AssistantActionView, type ThemeColorToken } from "../schemas";

/**
 * Voice assistant persistence. Every query runs with the member's own session (RLS: own rows in a
 * store they still belong to) AND filters by the server-resolved tenant + user, so a session id
 * from the client can only ever resolve to that member's own conversation in this store.
 */

type Owner = Pick<TenantContext, "tenantId"> & { user: { id: string } };

export type AssistantSession = { id: string; locale: AssistantLocale };

export async function findOwnSession(ctx: Owner, sessionId: string): Promise<AssistantSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_sessions")
    .select("id, locale")
    .eq("id", sessionId)
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? { id: data.id, locale: isAssistantLocale(data.locale) ? data.locale : "en-IN" } : null;
}

export async function latestOwnSession(ctx: Owner): Promise<AssistantSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_sessions")
    .select("id, locale")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id)
    .eq("surface", "dashboard")
    .gte("last_active_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return data ? { id: data.id, locale: isAssistantLocale(data.locale) ? data.locale : "en-IN" } : null;
}

export async function createSession(ctx: Owner, locale: AssistantLocale, title: string): Promise<AssistantSession> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_sessions")
    .insert({ tenant_id: ctx.tenantId, user_id: ctx.user.id, surface: "dashboard", locale, title: title.slice(0, 120) })
    .select("id")
    .single();
  if (error) throw mapDbError(error);
  return { id: data.id, locale };
}

export async function touchSession(ctx: Owner, sessionId: string, locale: AssistantLocale): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("assistant_sessions")
    .update({ locale, last_active_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id);
}

export async function loadHistory(ctx: Owner, sessionId: string, limit = 8): Promise<AssistantHistoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw mapDbError(error);
  return (data ?? []).reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
}

export async function appendMessage(
  ctx: Owner,
  m: { sessionId: string; role: "user" | "assistant"; content: string; locale: AssistantLocale; inputMode?: "voice" | "text"; provider?: string; model?: string; tokens?: number | null },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assistant_messages").insert({
    session_id: m.sessionId,
    tenant_id: ctx.tenantId,
    user_id: ctx.user.id,
    role: m.role,
    content: m.content.slice(0, 4000),
    locale: m.locale,
    input_mode: m.inputMode ?? null,
    provider: m.provider?.slice(0, 40) ?? null,
    model: m.model?.slice(0, 100) ?? null,
    tokens: m.tokens == null ? null : Math.max(0, Math.round(m.tokens)),
  });
  if (error) throw mapDbError(error);
}

// ---- Actions ---------------------------------------------------------------------------------

type ActionRow = {
  id: string;
  session_id: string;
  tool: string;
  status: string;
  args: Json;
  before_value: Json | null;
  after_value: Json | null;
};

export type ThemePatchArgs = { token: ThemeColorToken; color: string };

export function themePatchArgs(args: Json): ThemePatchArgs | null {
  const o = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  const token = o.token;
  const color = o.color;
  if (typeof token !== "string" || !(THEME_COLOR_TOKENS as readonly string[]).includes(token)) return null;
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/.test(color)) return null;
  return { token: token as ThemeColorToken, color };
}

const TOKEN_LABEL: Record<ThemeColorToken, string> = { primary: "Brand colour", accent: "Accent colour", background: "Background colour", text: "Text colour" };

export function actionView(row: ActionRow): AssistantActionView | null {
  const p = themePatchArgs(row.args);
  if (row.tool !== "propose_theme_patch" || !p) return null;
  const before = typeof row.before_value === "string" ? row.before_value : null;
  return {
    id: row.id,
    tool: "propose_theme_patch",
    status: (["proposed", "applied", "undone", "rejected", "failed"] as const).find((s) => s === row.status) ?? "failed",
    title: `${TOKEN_LABEL[p.token]} → ${p.color}`,
    token: p.token,
    before,
    after: p.color,
  };
}

export async function insertThemeProposal(ctx: Owner, sessionId: string, patch: ThemePatchArgs, before: string | null): Promise<AssistantActionView> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .insert({ session_id: sessionId, tenant_id: ctx.tenantId, user_id: ctx.user.id, tool: "propose_theme_patch", args: patch, before_value: before, after_value: patch.color })
    .select("id, session_id, tool, status, args, before_value, after_value")
    .single();
  if (error) throw mapDbError(error);
  const view = actionView(data);
  if (!view) throw new AppError("INTERNAL");
  return view;
}

export async function getOwnAction(ctx: Owner, actionId: string): Promise<ActionRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_actions")
    .select("id, session_id, tool, status, args, before_value, after_value")
    .eq("id", actionId)
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new AppError("NOT_FOUND", { fieldErrors: { _form: ["That suggestion isn't available any more."] } });
  return data;
}

/**
 * Status transition guarded by the expected current status (`.eq("status", from)`), so a double
 * click / retried request can only apply or undo once.
 */
export async function transitionAction(
  ctx: Owner,
  actionId: string,
  from: "proposed" | "applied",
  to: "applied" | "undone" | "rejected" | "failed",
  patch: { before_value?: Json; error?: string } = {},
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assistant_actions")
    .update({
      status: to,
      ...(patch.before_value !== undefined ? { before_value: patch.before_value } : {}),
      ...(patch.error ? { error: patch.error.slice(0, 300) } : {}),
      ...(to === "applied" ? { applied_at: now } : {}),
      ...(to === "undone" ? { undone_at: now } : {}),
    })
    .eq("id", actionId)
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.user.id)
    .eq("status", from)
    .select("id");
  if (error) throw mapDbError(error);
  return (data?.length ?? 0) > 0;
}

export type TranscriptItem = { role: "user" | "assistant"; content: string; at: string };

export async function loadTranscript(ctx: Owner, sessionId: string): Promise<{ messages: TranscriptItem[]; actions: AssistantActionView[] }> {
  const supabase = await createSupabaseServerClient();
  const [msgs, acts] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("assistant_actions")
      .select("id, session_id, tool, status, args, before_value, after_value")
      .eq("session_id", sessionId)
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (msgs.error) throw mapDbError(msgs.error);
  if (acts.error) throw mapDbError(acts.error);
  return {
    messages: (msgs.data ?? []).reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content, at: m.created_at })),
    actions: (acts.data ?? []).flatMap((a) => {
      const v = actionView(a);
      return v ? [v] : [];
    }),
  };
}
