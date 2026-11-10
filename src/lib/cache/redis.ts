import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Optional Upstash Redis client for the storefront L2 cache (ADR-010).
 * Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be set; otherwise
 * every helper is a no-op and the app behaves as Redis-free.
 */

let client: Redis | null | undefined;

/** Lazy singleton. `null` when env is incomplete. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    client = null;
    return client;
  }
  client = new Redis({ url, token });
  return client;
}

/** Clears the singleton so tests can toggle env between cases. */
export function resetRedisClientForTests() {
  client = undefined;
}
