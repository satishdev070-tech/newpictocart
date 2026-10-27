import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Cross-request cache for the storefront's per-tenant lookups (ADR-010 addendum): the hostname
 * directory, the published theme, the store profile and the feature flags. Cache Components stays
 * off, so this uses `unstable_cache` (the Data Cache). Rules:
 * - Only PUBLIC data, never anything read from cookies/headers or a user session (preview drafts
 *   and Live Preview are resolved outside these functions and are never cached).
 * - The cache key always includes the tenant id or the hostname (function arguments are part of
 *   the key), so tenants can't be mixed.
 * - Mutations invalidate with `revalidateStorefront(tenantId)`; out-of-band DB edits (scripts)
 *   show up after `STOREFRONT_CACHE_SECONDS` at most.
 * - Off in development, so `next dev` always reads the database.
 */

export const STOREFRONT_CACHE_SECONDS = 120;
export const TENANT_DIRECTORY_TAG = "tenant-directory";
/** On every cached storefront entry: for platform-wide changes (plans, global feature flags). */
export const ALL_STOREFRONTS_TAG = "storefront-all";
export const storefrontTag = (tenantId: string) => `tenant:${tenantId}:storefront`;

const enabled = process.env.NODE_ENV === "production";

/** Cache `fn(...args)` across requests under `name` + args, tagged for on-demand invalidation. */
export function cachedStorefront<A extends string[], R>(name: string, fn: (...args: A) => Promise<R>, tags: (...args: A) => string[]) {
  if (!enabled) return fn;
  return (...args: A): Promise<R> => unstable_cache(fn, ["sf", name], { tags: [ALL_STOREFRONTS_TAG, ...tags(...args)], revalidate: STOREFRONT_CACHE_SECONDS })(...args);
}

/**
 * Call after any change that affects how a store renders publicly: theme publish/rollback, store
 * profile/SEO/COD settings, domains, tenant status or plan/feature flags. The next request reads
 * fresh data (no stale window). Only this tenant's entries are dropped (including its directory
 * identity: slug, status, name, primary host); other stores keep their cache.
 */
export function revalidateStorefront(tenantId: string) {
  revalidateTag(storefrontTag(tenantId), { expire: 0 });
}

/**
 * Call after a hostname is added, verified, removed or moved between stores: drops every cached
 * hostname -> tenant mapping (keyed by hostname, so they go together). Only domain changes need
 * this; each store's next request then re-runs its host lookup once.
 */
export function revalidateTenantDirectory() {
  revalidateTag(TENANT_DIRECTORY_TAG, { expire: 0 });
}

/** Platform-wide change (a plan's features, a global feature flag): every store re-reads once. */
export function revalidateAllStorefronts() {
  revalidateTag(ALL_STOREFRONTS_TAG, { expire: 0 });
}
