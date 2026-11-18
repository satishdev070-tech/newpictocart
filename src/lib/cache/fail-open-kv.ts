/**
 * Fail-open wrapper for the KV namespace behind the vinext data cache.
 *
 * Why: the KV data adapter awaits `kv.get()` without a catch, so when KV fails (the Workers Free
 * daily read quota — "KV get() limit exceeded for the day." — or a transient outage) the error
 * escapes into the server render and every page that uses a cached read returns 500. The data
 * cache is only a cache: a failed read is a miss, a failed write or delete is skipped, and the
 * page renders from the database.
 *
 * After a failure the wrapper stops calling KV for `cooldownMs` (per isolate), so requests don't
 * keep paying for calls that will fail until the quota resets (00:00 UTC).
 */
export type KvLike = {
  get: (key: string | string[], options?: unknown) => Promise<unknown>;
  put: (key: string, value: unknown, options?: unknown) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

export type FailOpenOptions = {
  cooldownMs?: number;
  now?: () => number;
  log?: (message: string) => void;
};

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

export function failOpenKv<T extends KvLike>(kv: T, opts: FailOpenOptions = {}): T {
  const cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((m: string) => console.warn(m));
  let openUntil = 0;

  const tripped = () => now() < openUntil;
  const trip = (op: string, error: unknown) => {
    const first = !tripped();
    openUntil = now() + cooldownMs;
    if (first) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`[cache] KV ${op} failed, serving without the data cache for ${Math.round(cooldownMs / 1000)}s: ${msg}`);
    }
  };
  // A multi-key get resolves to a Map; a miss for every key keeps that shape.
  const miss = (key: string | string[]) => (Array.isArray(key) ? new Map(key.map((k) => [k, null])) : null);

  const call = async <R>(op: string, fallback: () => R, run: () => Promise<R>): Promise<R> => {
    if (tripped()) return fallback();
    try {
      return await run();
    } catch (error) {
      trip(op, error);
      return fallback();
    }
  };

  return new Proxy(kv, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return (key: string | string[], options?: unknown) =>
          call("get", () => miss(key), () => (options === undefined ? target.get(key) : target.get(key, options)));
      }
      if (prop === "put") {
        return (key: string, value: unknown, options?: unknown) => call("put", () => undefined, () => target.put(key, value, options));
      }
      if (prop === "delete") {
        return (key: string) => call("delete", () => undefined, () => target.delete(key));
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
