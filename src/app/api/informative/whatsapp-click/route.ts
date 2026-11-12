import { z } from "zod";
import { findStoreTenant } from "@/features/cart/context";
import { informativeFlagMode, informativeFlagOn } from "@/features/informative/flag";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INTERNAL_HOST_HEADER } from "@/lib/tenant/routing";
import { logger } from "@/lib/observability/logger";

/**
 * WhatsApp-click beacon of a live Informative Website (enquiry source WHATSAPP_CLICK). Always 204
 * so the response reveals nothing. Tenant = proxy-verified host (never request input); the
 * mutation is accepted only from a same-origin page (Origin check), within 10 per 10 minutes per
 * IP + site; the database caps clicks per site and stores no visitor data.
 */
const NO_CONTENT = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const bodySchema = z.object({ serviceId: z.uuid().optional() }).catch({});

export async function POST(request: Request) {
  try {
    if (!informativeFlagOn(informativeFlagMode())) return NO_CONTENT();
    if (Number(request.headers.get("content-length") ?? "0") > 512) return NO_CONTENT();
    const host = request.headers.get(INTERNAL_HOST_HEADER);
    const origin = request.headers.get("origin");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host.toLowerCase() : null;
    } catch {
      originHost = null;
    }
    if (!host || !originHost || originHost.split(":")[0] !== host.split(":")[0]) return NO_CONTENT();
    const tenant = await findStoreTenant();
    if (!tenant || tenant.websiteType !== "INFORMATIVE") return NO_CONTENT();
    let raw: unknown = {};
    try {
      const text = await request.text();
      raw = text ? JSON.parse(text) : {};
    } catch {
      raw = {};
    }
    const { serviceId } = bodySchema.parse(raw);
    await rateLimit("info-wa-click", `${tenant.tenantId}:${await clientIpKey()}`, 10, 600);
    const { error } = await (await createSupabaseServerClient()).rpc("record_info_whatsapp_click", { p_tenant: tenant.tenantId, p_service: (serviceId ?? null) as unknown as string });
    if (error) logger.warn("informative.whatsapp_click_failed", { tenantId: tenant.tenantId, code: error.code });
  } catch (err) {
    // Rate limited or transient: the visitor is already on WhatsApp; never surface an error.
    logger.info("informative.whatsapp_click_skipped", { reason: err instanceof Error ? err.name : "unknown" });
  }
  return NO_CONTENT();
}
