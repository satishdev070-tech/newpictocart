import "server-only";
import { logger } from "@/lib/observability/logger";

/**
 * Dynamic sharp import — native sharp does not load on Cloudflare Workers.
 * Callers must soft-fail (skip resize / throw AppError) when this returns null.
 */
export async function loadSharp(): Promise<typeof import("sharp") | null> {
  try {
    return await import("sharp");
  } catch (err) {
    logger.warn("media.sharp_unavailable", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
