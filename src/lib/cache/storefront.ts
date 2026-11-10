import "server-only";
import { cachedPublic, redisEntryKey as publicRedisEntryKey, revalidatePublicTags } from "@/lib/cache/public-cache";

/**
 * Cross-request cache for the storefront's per-tenant lookups (ADR-010 addendum): the hostname
 * directory, the published theme, the store profile and the feature flags. Cache Components stays
 * off, so this uses `unstable_cache` (the Data Cache) as L1 via `cachedPublic`. When Upstash env is
 * set, Redis is L2 so cold Vercel instances share public storefront reads without re-hitting
 * Supabase.
 *
 * Rules:
 * - Only PUBLIC data, never anything read from cookies/headers or a user session (preview drafts
 *   and Live Preview are resolved outside these functions and are never cached).
 * - The cache key always includes the tenant id or the hostname (function arguments are part of
 *   the key), so tenants can't be mixed.
 * - Mutations invalidate with `revalidateStorefront(tenantId)` (L1 tag + Redis keys); out-of-band
 *   DB edits (scripts) show up after `STOREFRONT_CACHE_SECONDS` at most.
 * - Off in development, so `next dev` always reads the database.
 * - Redis errors fail open: the request continues from L1/DB.
 */

export const STOREFRONT_CACHE_SECONDS = 120;
export const TENANT_DIRECTORY_TAG = "tenant-directory";
/** On every cached storefront entry: for platform-wide changes (plans, global feature flags). */
export const ALL_STOREFRONTS_TAG = "storefront-all";
export const storefrontTag = (tenantId: string) => `tenant:${tenantId}:storefront`;

const REDIS_KEY_PREFIX = "sf:v1";

/** Redis entry key for storefront L2 (tests + diagnostics). */
export function redisEntryKey(name: string, args: string[]): string {
  return publicRedisEntryKey(REDIS_KEY_PREFIX, name, args);
}

/** Cache `fn(...args)` across requests under `name` + args, tagged for on-demand invalidation. */
export function cachedStorefront<A extends string[], R>(name: string, fn: (...args: A) => Promise<R>, tags: (...args: A) => string[]) {
  return cachedPublic(name, fn, {
    keyPrefix: REDIS_KEY_PREFIX,
    revalidateSeconds: STOREFRONT_CACHE_SECONDS,
    tags: (...args: A) => [ALL_STOREFRONTS_TAG, ...tags(...args)],
  });
}

/**
 * Call after any change that affects how a store renders publicly: theme publish/rollback, store
 * profile/SEO/COD settings, domains, tenant status or plan/feature flags. The next request reads
 * fresh data (no stale window). Only this tenant's entries are dropped (including its directory
 * identity: slug, status, name, primary host); other stores keep their cache.
 */
export function revalidateStorefront(tenantId: string) {
  revalidatePublicTags(storefrontTag(tenantId));
}

/**
 * Call after a hostname is added, verified, removed or moved between stores: drops every cached
 * hostname -> tenant mapping (keyed by hostname, so they go together). Only domain changes need
 * this; each store's next request then re-runs its host lookup once.
 */
export function revalidateTenantDirectory() {
  revalidatePublicTags(TENANT_DIRECTORY_TAG);
}

/**
 * Platform-wide change (a plan's features, a global feature flag): every store re-reads once.
 * L1 drops immediately via the global tag; Redis L2 clears the tracked key index (or expires in
 * `STOREFRONT_CACHE_SECONDS` if Redis is unreachable).
 */
export function revalidateAllStorefronts() {
  revalidatePublicTags(ALL_STOREFRONTS_TAG);
}
