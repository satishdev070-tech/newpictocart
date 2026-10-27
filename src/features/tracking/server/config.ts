import "server-only";
import { cache } from "react";
import { cachedStorefront, storefrontTag } from "@/lib/cache/storefront";
import { logger } from "@/lib/observability/logger";
import { activePublicConfigs } from "@/features/integrations/server/store";
import type { TrackingConfig } from "../components/tracking-tags";

/**
 * Enabled tags of a store, cached per tenant (integration and plan changes revalidate the
 * storefront). Only public IDs are read; tracking has no secrets. Errors are not cached.
 */
const loadTrackingConfig = cachedStorefront(
  "tracking-config",
  async (tenantId: string): Promise<TrackingConfig | null> => {
    const { ga4, google_ads: ads, meta_pixel: pixel } = await activePublicConfigs(tenantId, ["ga4", "google_ads", "meta_pixel"]);
    const cfg: TrackingConfig = {
      ga4: ga4?.measurement_id ?? null,
      ads: ads?.ads_id && ads.purchase_label ? { id: ads.ads_id, label: ads.purchase_label } : null,
      pixel: pixel?.pixel_id ?? null,
    };
    return cfg.ga4 || cfg.ads || cfg.pixel ? cfg : null;
  },
  (tenantId) => [storefrontTag(tenantId)],
);

/** Tracking tags for a store (tenant from the verified host), or null. Never throws. */
export const getTrackingConfig = cache(async (tenantId: string): Promise<TrackingConfig | null> => {
  try {
    return await loadTrackingConfig(tenantId);
  } catch (err) {
    logger.warn("tracking.config_unavailable", { tenantId, error: err });
    return null;
  }
});
