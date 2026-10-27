import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getRedis } from "@/lib/cache/redis";

/**
 * Cross-request cache for the storefront's per-tenant lookups (ADR-010 addendum): the hostname
 * directory, the published theme, the store profile and the feature flags. Cache Components stays
 * off, so this uses `unstable_cache` (the Data Cache) as L1. When Upstash env is set, Redis is L2
 * so cold Vercel instances share public storefront reads without re-hitting Supabase.
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
const TENANT_INDEX = (tenantId: string) => `${REDIS_KEY_PREFIX}:idx:t:${tenantId}`;
const DIRECTORY_INDEX = `${REDIS_KEY_PREFIX}:idx:dir`;
const ALL_INDEX = `${REDIS_KEY_PREFIX}:idx:all`;
/** Keep indexes slightly longer than entry TTL so invalidation still finds keys. */
const INDEX_TTL_SECONDS = STOREFRONT_CACHE_SECONDS + 60;

const enabled = process.env.NODE_ENV === "production";

type Box<T> = { v: T };

export function redisEntryKey(name: string, args: string[]): string {
  return `${REDIS_KEY_PREFIX}:e:${name}:${args.map(encodeURIComponent).join(",")}`;
}

function indexKeysForTags(tags: string[]): string[] {
  const indexes: string[] = [ALL_INDEX];
  for (const tag of tags) {
    if (tag === TENANT_DIRECTORY_TAG) indexes.push(DIRECTORY_INDEX);
    if (tag.startsWith("tenant:") && tag.endsWith(":storefront")) {
      indexes.push(TENANT_INDEX(tag.slice("tenant:".length, -":storefront".length)));
    }
  }
  return indexes;
}

async function redisGet<R>(key: string): Promise<{ hit: true; value: R } | { hit: false }> {
  const redis = getRedis();
  if (!redis) return { hit: false };
  try {
    const box = await redis.get<Box<R>>(key);
    if (box == null) return { hit: false };
    return { hit: true, value: box.v };
  } catch {
    return { hit: false };
  }
}

async function redisSet<R>(key: string, value: R, tags: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const pipe = redis.pipeline();
    pipe.set(key, { v: value } satisfies Box<R>, { ex: STOREFRONT_CACHE_SECONDS });
    for (const index of indexKeysForTags(tags)) {
      pipe.sadd(index, key);
      pipe.expire(index, INDEX_TTL_SECONDS);
    }
    await pipe.exec();
  } catch {
    // fail open
  }
}

async function redisDeleteByIndex(indexKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.smembers(indexKey);
    if (keys.length > 0) await redis.del(...keys, indexKey);
    else await redis.del(indexKey);
  } catch {
    // fail open
  }
}

/** Load from Redis L2 when configured; otherwise call `fn`. Never caches thrown errors. */
async function withRedisLayer<A extends string[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  tags: (...args: A) => string[],
  args: A,
): Promise<R> {
  const key = redisEntryKey(name, args);
  const cached = await redisGet<R>(key);
  if (cached.hit) return cached.value;
  const value = await fn(...args);
  await redisSet(key, value, tags(...args));
  return value;
}

/** Cache `fn(...args)` across requests under `name` + args, tagged for on-demand invalidation. */
export function cachedStorefront<A extends string[], R>(name: string, fn: (...args: A) => Promise<R>, tags: (...args: A) => string[]) {
  if (!enabled) return fn;
  const loader = (...args: A): Promise<R> => withRedisLayer(name, fn, tags, args);
  return (...args: A): Promise<R> =>
    unstable_cache(loader, ["sf", name], { tags: [ALL_STOREFRONTS_TAG, ...tags(...args)], revalidate: STOREFRONT_CACHE_SECONDS })(...args);
}

/**
 * Call after any change that affects how a store renders publicly: theme publish/rollback, store
 * profile/SEO/COD settings, domains, tenant status or plan/feature flags. The next request reads
 * fresh data (no stale window). Only this tenant's entries are dropped (including its directory
 * identity: slug, status, name, primary host); other stores keep their cache.
 */
export function revalidateStorefront(tenantId: string) {
  revalidateTag(storefrontTag(tenantId), { expire: 0 });
  void redisDeleteByIndex(TENANT_INDEX(tenantId));
}

/**
 * Call after a hostname is added, verified, removed or moved between stores: drops every cached
 * hostname -> tenant mapping (keyed by hostname, so they go together). Only domain changes need
 * this; each store's next request then re-runs its host lookup once.
 */
export function revalidateTenantDirectory() {
  revalidateTag(TENANT_DIRECTORY_TAG, { expire: 0 });
  void redisDeleteByIndex(DIRECTORY_INDEX);
}

/**
 * Platform-wide change (a plan's features, a global feature flag): every store re-reads once.
 * L1 drops immediately via the global tag; Redis L2 clears the tracked key index (or expires in
 * `STOREFRONT_CACHE_SECONDS` if Redis is unreachable).
 */
export function revalidateAllStorefronts() {
  revalidateTag(ALL_STOREFRONTS_TAG, { expire: 0 });
  void redisDeleteByIndex(ALL_INDEX);
}
