import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { publicEnv } from "@/lib/env/public";
import { classifyHost } from "@/lib/tenant/host";
import { platformHostAliases } from "@/lib/platform/hosts";
import { clientIpKey, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { isTrackablePath, type PageviewInput } from "../pageview";

/**
 * Records one first-party page view. Silently drops anything that isn't a platform host,
 * a trackable path, or when tracking is switched off. Never throws.
 * Writes go through the anon-callable record_platform_page_view() RPC (validated in SQL).
 */
export async function recordPageview(host: string | null, view: PageviewInput): Promise<"recorded" | "ignored" | "limited"> {
  try {
    const env = publicEnv();
    if (classifyHost(host, env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN, platformHostAliases()).kind !== "platform" || !host) return "ignored";
    if (!isTrackablePath(view.path)) return "ignored";
    const config = await getPublicPlatformConfig();
    if (!config.firstPartyAnalytics) return "ignored";
    try {
      await rateLimit("platform-pageview", await clientIpKey(), 120, 60);
    } catch {
      return "limited";
    }
    const { error } = await createSupabasePublicClient().rpc("record_platform_page_view", { p_session: view.sid, p_path: view.path, p_referrer: view.referrer ?? "", p_host: host });
    if (error) {
      // PGRST202: migration not applied yet. Stay quiet; the admin page explains it.
      if (error.code !== "PGRST202") logger.warn("platform_pageview.insert_failed", { code: error.code });
      return "ignored";
    }
    return "recorded";
  } catch (err) {
    logger.warn("platform_pageview.failed", { error: err });
    return "ignored";
  }
}
