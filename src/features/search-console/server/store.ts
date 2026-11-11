import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { mapDbError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/observability/logger";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import { runGscDeliveryCheck, runGscDnsCheck } from "../checks";
import { GSC_DOMAIN_INFO, GSC_DOMAINS, gscPublicUrl, type GscDnsStatus, type GscDomain } from "../verification";

/**
 * Data access for Search Console verification. Staff reads/writes run as the signed-in user
 * (RLS: platform.settings.manage). Public delivery uses the anon client and the
 * security-definer gsc_verification_file() RPC, which returns only an active file's content.
 */

const TABLE = "platform_search_console_verifications";
export const GSC_MIGRATION = "20261111007200_search_console_verification.sql";
const PERMISSION = "platform.settings.manage" as const;

export type GscRow = {
  id: string;
  domain: string;
  method: string;
  filename: string | null;
  content: string | null;
  dns_value: string | null;
  active: boolean;
  uploaded_by: string | null;
  last_delivery_check_at: string | null;
  last_delivery_status: string | null;
  last_delivery_error: string | null;
  last_dns_check_at: string | null;
  last_dns_status: string | null;
  created_at: string;
  updated_at: string;
};

export type GscDomainState = { html: GscRow | null; dns: GscRow | null };
export type GscState = { ready: true; domains: Record<GscDomain, GscDomainState> } | { ready: false };

type PgError = { code?: string; message?: string } | null | undefined;

/** Table/function not created yet (migration not applied on this database). */
export function isMissingRelation(error: PgError): boolean {
  const code = error?.code ?? "";
  return code === "42P01" || code === "PGRST205" || code === "PGRST202" || code === "42883";
}

function notReady(): AppError {
  return new AppError("CONFLICT", { message: `Search Console verification isn't set up on this database yet. Apply supabase/migrations/${GSC_MIGRATION}, then reload.` });
}

function dbError(error: PgError, context?: Record<string, unknown>): AppError {
  return isMissingRelation(error) ? notReady() : mapDbError(error, context);
}

/** Admin page read. Fails soft: a missing table reports `ready: false` instead of breaking the page. */
export async function loadGscState(): Promise<GscState> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from(TABLE).select("*");
    if (error) {
      if (!isMissingRelation(error)) logger.warn("gsc.load_failed", { code: error.code, message: error.message });
      return { ready: false };
    }
    const domains = Object.fromEntries(GSC_DOMAINS.map((d) => [d, { html: null, dns: null }])) as Record<GscDomain, GscDomainState>;
    for (const row of (data ?? []) as GscRow[]) {
      const slot = domains[row.domain as GscDomain];
      if (!slot) continue;
      if (row.method === "html_file") slot.html = row;
      else if (row.method === "dns_txt") slot.dns = row;
    }
    return { ready: true, domains };
  } catch (err) {
    logger.warn("gsc.load_failed", { error: err });
    return { ready: false };
  }
}

/** Public delivery lookup. Null on not-found, missing migration or any error (served as 404). */
export async function findGscFileContent(domain: GscDomain, filename: string): Promise<string | null> {
  try {
    const { data, error } = await createSupabasePublicClient().rpc("gsc_verification_file", { p_domain: domain, p_filename: filename });
    if (error) {
      if (!isMissingRelation(error)) logger.warn("gsc.delivery_lookup_failed", { code: error.code });
      return null;
    }
    return typeof data === "string" && data.length > 0 ? data : null;
  } catch (err) {
    logger.warn("gsc.delivery_lookup_failed", { error: err });
    return null;
  }
}

async function getRow(domain: GscDomain, method: "html_file" | "dns_txt"): Promise<GscRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("domain", domain).eq("method", method).maybeSingle();
  if (error) throw dbError(error, { domain, method });
  return (data as GscRow | null) ?? null;
}

function gscAudit(ctx: PlatformContext, action: `${string}.${string}`, domain: GscDomain, metadata: Record<string, string | boolean | null>) {
  return audit({ tenantId: null, actorUserId: ctx.user.id, actorType: "platform", action, entityType: "search_console_verification", entityId: domain, metadata });
}

/** Upload or replace the HTML verification file for one domain (validated by the caller). */
export async function saveGscFile(ctx: PlatformContext, domain: GscDomain, file: { filename: string; content: string }): Promise<void> {
  assertPlatformPermission(ctx, PERMISSION);
  const before = await getRow(domain, "html_file");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      domain,
      method: "html_file",
      filename: file.filename,
      content: file.content,
      active: true,
      uploaded_by: ctx.user.id,
      last_delivery_check_at: null,
      last_delivery_status: null,
      last_delivery_error: null,
    },
    { onConflict: "domain,method" },
  );
  if (error) throw dbError(error, { domain });
  const replaced = before?.active ? before.filename : null;
  await gscAudit(ctx, replaced ? "search_console.file_replaced" : "search_console.file_uploaded", domain, { filename: file.filename, previous: replaced });
}

export async function removeGscFile(ctx: PlatformContext, domain: GscDomain): Promise<void> {
  assertPlatformPermission(ctx, PERMISSION);
  const before = await getRow(domain, "html_file");
  if (!before?.active) throw new AppError("NOT_FOUND", { message: "There is no verification file to remove." });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).update({ active: false, last_delivery_check_at: null, last_delivery_status: null, last_delivery_error: null }).eq("id", before.id);
  if (error) throw dbError(error, { domain });
  await gscAudit(ctx, "search_console.file_removed", domain, { filename: before.filename });
}

export async function saveGscDns(ctx: PlatformContext, domain: GscDomain, value: string): Promise<void> {
  assertPlatformPermission(ctx, PERMISSION);
  const before = await getRow(domain, "dns_txt");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ domain, method: "dns_txt", dns_value: value, active: true, uploaded_by: ctx.user.id, last_dns_check_at: null, last_dns_status: null }, { onConflict: "domain,method" });
  if (error) throw dbError(error, { domain });
  await gscAudit(ctx, "search_console.dns_saved", domain, { value, previous: before?.active ? before.dns_value : null });
}

export async function removeGscDns(ctx: PlatformContext, domain: GscDomain): Promise<void> {
  assertPlatformPermission(ctx, PERMISSION);
  const before = await getRow(domain, "dns_txt");
  if (!before?.active) throw new AppError("NOT_FOUND", { message: "There is no DNS value to remove." });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).update({ active: false, last_dns_check_at: null, last_dns_status: null }).eq("id", before.id);
  if (error) throw dbError(error, { domain });
  await gscAudit(ctx, "search_console.dns_removed", domain, { value: before.dns_value });
}

/** Fetches the public URL now and records the outcome. */
export async function checkGscDelivery(ctx: PlatformContext, domain: GscDomain, opts: { fetchImpl?: typeof fetch } = {}): Promise<{ ok: boolean; reason: string | null; url: string }> {
  assertPlatformPermission(ctx, PERMISSION);
  const row = await getRow(domain, "html_file");
  if (!row?.active || !row.filename || !row.content) throw new AppError("NOT_FOUND", { message: "Upload a verification file first." });
  const url = gscPublicUrl(domain, row.filename);
  const result = await runGscDeliveryCheck(url, row.content, opts);
  const reason = result.ok ? null : result.reason;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ last_delivery_check_at: new Date().toISOString(), last_delivery_status: result.ok ? "ok" : "failed", last_delivery_error: reason?.slice(0, 500) ?? null })
    .eq("id", row.id);
  if (error) throw dbError(error, { domain });
  await gscAudit(ctx, "search_console.delivery_checked", domain, { url, ok: result.ok, reason });
  return { ok: result.ok, reason, url };
}

/** Looks up the apex TXT records now (DNS-over-HTTPS) and records the outcome. Never edits DNS. */
export async function checkGscDns(ctx: PlatformContext, domain: GscDomain, opts: { fetchImpl?: typeof fetch } = {}): Promise<GscDnsStatus> {
  assertPlatformPermission(ctx, PERMISSION);
  const row = await getRow(domain, "dns_txt");
  if (!row?.active || !row.dns_value) throw new AppError("NOT_FOUND", { message: "Save the TXT value first." });
  const status = await runGscDnsCheck(GSC_DOMAIN_INFO[domain].apex, row.dns_value, opts);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).update({ last_dns_check_at: new Date().toISOString(), last_dns_status: status }).eq("id", row.id);
  if (error) throw dbError(error, { domain });
  await gscAudit(ctx, "search_console.dns_checked", domain, { status });
  return status;
}
