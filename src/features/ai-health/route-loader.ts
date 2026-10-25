import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { AI_PROVIDERS, type AiProvider } from "@/features/neural-pulse/schemas";
import type { FeatureRoute } from "./registry";

const isProvider = (v: unknown): v is AiProvider => (AI_PROVIDERS as readonly unknown[]).includes(v);

/**
 * The saved route for one AI feature, read with the caller's own client (the table holds no
 * secrets and is readable by any signed-in user, migration 3900). Null when there is no row, the
 * migration is pending, or anything fails, so generation keeps today's provider order.
 */
export const loadFeatureRoute = cache(async (featureKey: string): Promise<FeatureRoute | null> => {
  try {
    const { data, error } = await (await createSupabaseServerClient())
      .from("ai_feature_routes")
      .select("feature_key, primary_provider, primary_model, fallback_provider, fallback_model, enabled")
      .eq("feature_key", featureKey)
      .maybeSingle();
    if (error) {
      logger.warn("ai_routes.read_failed", { featureKey, code: error.code });
      return null;
    }
    if (!data || !isProvider(data.primary_provider)) return null;
    return {
      featureKey: data.feature_key,
      primaryProvider: data.primary_provider,
      primaryModel: data.primary_model,
      fallbackProvider: isProvider(data.fallback_provider) ? data.fallback_provider : null,
      fallbackModel: data.fallback_model,
      enabled: data.enabled,
    };
  } catch (err) {
    logger.warn("ai_routes.read_failed", { featureKey, error: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
    return null;
  }
});
