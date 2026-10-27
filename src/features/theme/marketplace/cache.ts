import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/** Public marketplace catalogue of custom themes (Super Admin publish). */
export const MARKETPLACE_CUSTOM_THEMES_TAG = "marketplace-custom-themes";
/** Open demo-store slug set for Live Preview buttons. */
export const MARKETPLACE_DEMO_ORIGINS_TAG = "marketplace-demo-origins";

const enabled = process.env.NODE_ENV === "production";

/** Cross-request cache for public marketplace reads (production only). */
export function cachedMarketplacePublic<R>(name: string, fn: () => Promise<R>, tags: string[], revalidateSeconds: number): () => Promise<R> {
  if (!enabled) return fn;
  return unstable_cache(fn, ["marketplace", name], { tags, revalidate: revalidateSeconds });
}

export function revalidateMarketplaceCatalogue() {
  revalidateTag(MARKETPLACE_CUSTOM_THEMES_TAG, { expire: 0 });
}

export function revalidateMarketplaceDemos() {
  revalidateTag(MARKETPLACE_DEMO_ORIGINS_TAG, { expire: 0 });
}
