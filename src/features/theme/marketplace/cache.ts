import "server-only";
import { cachedPublic, revalidatePublicTags } from "@/lib/cache/public-cache";

/** Public marketplace catalogue of custom themes (Super Admin publish). */
export const MARKETPLACE_CUSTOM_THEMES_TAG = "marketplace-custom-themes";
/** Open demo-store slug set for Live Preview buttons. */
export const MARKETPLACE_DEMO_ORIGINS_TAG = "marketplace-demo-origins";

const KEY_PREFIX = "pub:v1";

/** Cross-request cache for public marketplace reads (production L1 + optional Redis L2). */
export function cachedMarketplacePublic<R>(name: string, fn: () => Promise<R>, tags: string[], revalidateSeconds: number): () => Promise<R> {
  return cachedPublic(name, fn, { tags, revalidateSeconds, keyPrefix: KEY_PREFIX });
}

export function revalidateMarketplaceCatalogue() {
  revalidatePublicTags(MARKETPLACE_CUSTOM_THEMES_TAG);
}

export function revalidateMarketplaceDemos() {
  revalidatePublicTags(MARKETPLACE_DEMO_ORIGINS_TAG);
}
