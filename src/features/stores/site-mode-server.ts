import "server-only";

import { cache } from "react";
import { cachedStorefront, storefrontTag } from "@/lib/cache/storefront";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { logger } from "@/lib/observability/logger";
import { AppError } from "@/lib/errors";
import { DEFAULT_SITE_MODE, parseSiteMode, type SiteMode } from "./site-mode";

class SiteModeLookupFailed extends Error {}

/** Public site_mode flag, cached per tenant (settings save calls revalidateStorefront). Errors are not cached. */
const lookup = cachedStorefront(
  "site-mode",
  async (tenantId: string): Promise<SiteMode> => {
    const { data, error } = await createSupabasePublicClient().from("stores").select("site_mode").eq("tenant_id", tenantId).maybeSingle();
    if (error) {
      logger.warn("stores.site_mode_unavailable", { tenantId, code: error.code });
      throw new SiteModeLookupFailed();
    }
    return parseSiteMode(data?.site_mode);
  },
  (tenantId) => [storefrontTag(tenantId)],
);

/**
 * Public mode read used only after the tenant has already been resolved from its verified host.
 * A not-yet-applied 3300 migration deliberately falls back to ecommerce so deployed stores keep
 * their established behaviour while the schema rollout catches up. Memoised per request.
 */
export const getStoreSiteMode = cache(async (tenantId: string): Promise<SiteMode> => {
  try {
    return await lookup(tenantId);
  } catch {
    return DEFAULT_SITE_MODE;
  }
});

/** Server-action guard for cart and checkout mutations on a verified storefront host. */
export async function requireEcommerceSite(tenantId: string): Promise<void> {
  if ((await getStoreSiteMode(tenantId)) === "informative") throw new AppError("TENANT_UNAVAILABLE");
}
