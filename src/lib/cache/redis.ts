import "server-only";
import type { Redis } from "@upstash/redis";

/**
 * Optional Upstash Redis client for the storefront L2 cache (ADR-010).
 * Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be set; otherwise
 * every helper is a no-op and the app behaves as Redis-free.
 *
 * The SDK (~180 KB) is imported lazily, only when Redis is configured: this module sits in the
 * Worker's always-loaded graph (public-cache → marketing layout), so a static import cost every
 * cold isolate CPU even when Redis is off (Error 1102, docs/DEPLOY_CLOUDFLARE_WORKERS.md).
 */

let client: Promise<Redis | null> | undefined;

/** Lazy singleton. Resolves to `null` when env is incomplete (the SDK is then never loaded). */
export function getRedis(): Promise<Redis | null> {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    client = Promise.resolve(null);
    return client;
  }
  client = import("@upstash/redis").then(
    ({ Redis }) => new Redis({ url, token }),
    () => {
      // Loading failed (should not happen): behave as Redis-free and allow a retry later.
      client = undefined;
      return null;
    },
  );
  return client;
}

/** Clears the singleton so tests can toggle env between cases. */
export function resetRedisClientForTests() {
  client = undefined;
}
