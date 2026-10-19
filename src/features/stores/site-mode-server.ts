import "server-only";

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { logger } from "@/lib/observability/logger";
import { AppError } from "@/lib/errors";
import { DEFAULT_SITE_MODE, parseSiteMode, type SiteMode } from "./site-mode";

/**
 * Public mode read used only after the tenant has already been resolved from its verified host.
 * A not-yet-applied 3300 migration deliberately falls back to ecommerce so deployed stores keep
 * their established behaviour while the schema rollout catches up.
 */
export async function getStoreSiteMode(tenantId: string): Promise<SiteMode> {
  const { data, error } = await createSupabasePublicClient().from("stores").select("site_mode").eq("tenant_id", tenantId).maybeSingle();
  if (error) {
    logger.warn("stores.site_mode_unavailable", { tenantId, code: error.code });
    return DEFAULT_SITE_MODE;
  }
  return parseSiteMode(data?.site_mode);
}

/** Server-action guard for cart and checkout mutations on a verified storefront host. */
export async function requireEcommerceSite(tenantId: string): Promise<void> {
  if ((await getStoreSiteMode(tenantId)) === "informative") throw new AppError("TENANT_UNAVAILABLE");
}
