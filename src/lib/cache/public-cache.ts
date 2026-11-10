import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getRedis } from "@/lib/cache/redis";

/**
 * Shared production cache for **public** catalogues (ADR-010): Next `unstable_cache` as L1,
 * optional Upstash Redis as L2. Same fail-open + tag → Redis index-set invalidation pattern as
 * the original storefront helpers.
 *
 * Rules:
 * - Public / anon-readable platform data only. Never session, cookies, or private dashboard lists.
 * - Cache keys are `keyPrefix` + name + string args (never headers/cookies).
 * - Off outside production so `next dev` always hits the database.
 * - Redis errors and L2 op timeouts (~300ms) fail open (request continues from L1/DB).
 */

type Box<T> = { v: T };

const enabled = process.env.NODE_ENV === "production";

/** Cap Redis L2 wait so a hung Upstash call cannot stall public catalogue reads. */
export const REDIS_OP_TIMEOUT_MS = 300;

/** Prefixes that have registered L2 entries (invalidation walks these). */
const registeredPrefixes = new Set<string>();

export function redisEntryKey(keyPrefix: string, name: string, args: string[]): string {
  return `${keyPrefix}:e:${name}:${args.map(encodeURIComponent).join(",")}`;
}

export function redisTagIndexKey(keyPrefix: string, tag: string): string {
  return `${keyPrefix}:idx:${encodeURIComponent(tag)}`;
}

function registerPrefix(keyPrefix: string) {
  registeredPrefixes.add(keyPrefix);
}

/** Test helper: clear prefix registry between cases. */
export function resetPublicCachePrefixesForTests() {
  registeredPrefixes.clear();
}

/**
 * Race `promise` against a timer. On timeout, rejects with `Error("timeout")`
 * so callers can treat it like any other Redis failure (fail-open / miss).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function redisGet<R>(key: string): Promise<{ hit: true; value: R } | { hit: false }> {
  const redis = getRedis();
  if (!redis) return { hit: false };
  try {
    const box = await withTimeout(redis.get<Box<R>>(key), REDIS_OP_TIMEOUT_MS);
    if (box == null) return { hit: false };
    return { hit: true, value: box.v };
  } catch {
    return { hit: false };
  }
}

async function redisSet<R>(keyPrefix: string, key: string, value: R, tags: string[], revalidateSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const indexTtl = revalidateSeconds + 60;
    const pipe = redis.pipeline();
    pipe.set(key, { v: value } satisfies Box<R>, { ex: revalidateSeconds });
    for (const tag of tags) {
      const index = redisTagIndexKey(keyPrefix, tag);
      pipe.sadd(index, key);
      pipe.expire(index, indexTtl);
    }
    await withTimeout(pipe.exec(), REDIS_OP_TIMEOUT_MS);
  } catch {
    // fail open
  }
}

async function redisDeleteByIndex(indexKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await withTimeout(redis.smembers(indexKey), REDIS_OP_TIMEOUT_MS);
    if (keys.length > 0) await withTimeout(redis.del(...keys, indexKey), REDIS_OP_TIMEOUT_MS);
    else await withTimeout(redis.del(indexKey), REDIS_OP_TIMEOUT_MS);
  } catch {
    // fail open
  }
}

async function withRedisLayer<A extends string[], R>(
  keyPrefix: string,
  name: string,
  fn: (...args: A) => Promise<R>,
  tags: string[],
  revalidateSeconds: number,
  args: A,
): Promise<R> {
  const key = redisEntryKey(keyPrefix, name, args);
  const cached = await redisGet<R>(key);
  if (cached.hit) return cached.value;
  const value = await fn(...args);
  await redisSet(keyPrefix, key, value, tags, revalidateSeconds);
  return value;
}

export type CachedPublicOptions<A extends string[]> = {
  /** Static tags, or tags derived from the string args (part of the L1/L2 key). */
  tags: string[] | ((...args: A) => string[]);
  revalidateSeconds: number;
  /** Redis + L1 key namespace, e.g. `sf:v1` (storefront) or `pub:v1` (platform catalogues). */
  keyPrefix: string;
};

/**
 * Cache `fn(...args)` across requests under `keyPrefix` + `name` + args.
 * Production only; optional Redis L2 when Upstash env is set.
 */
export function cachedPublic<A extends string[], R>(name: string, fn: (...args: A) => Promise<R>, options: CachedPublicOptions<A>): (...args: A) => Promise<R> {
  registerPrefix(options.keyPrefix);
  if (!enabled) return fn;

  const resolveTags = (...args: A): string[] => (typeof options.tags === "function" ? options.tags(...args) : options.tags);

  const loader = (...args: A): Promise<R> => {
    const tags = resolveTags(...args);
    return withRedisLayer(options.keyPrefix, name, fn, tags, options.revalidateSeconds, args);
  };

  return (...args: A): Promise<R> =>
    unstable_cache(loader, [options.keyPrefix, name], { tags: resolveTags(...args), revalidate: options.revalidateSeconds })(...args);
}

/**
 * Drop L1 (`revalidateTag`) and indexed Redis L2 keys for each tag.
 * Walks every `keyPrefix` registered via `cachedPublic` (and any seeded defaults).
 */
export function revalidatePublicTags(...tags: string[]) {
  const prefixes = registeredPrefixes.size > 0 ? registeredPrefixes : new Set(["sf:v1", "pub:v1"]);
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
    for (const prefix of prefixes) {
      void redisDeleteByIndex(redisTagIndexKey(prefix, tag));
    }
  }
}
