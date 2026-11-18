import createKvDataCacheAdapter from "@vinext/cloudflare/cache/kv-data-adapter.runtime";
import { failOpenKv, type KvLike } from "./fail-open-kv";

/**
 * vinext `cache.data` runtime adapter (wired in vite.config.ts): the stock KV data adapter over a
 * fail-open KV binding, so a KV quota error or outage is a cache miss instead of a 500.
 */
type Args = Parameters<typeof createKvDataCacheAdapter>[0];

export default function failOpenKvDataAdapter(args: Args) {
  const binding = (args.options as { binding?: string } | undefined)?.binding ?? "VINEXT_KV_CACHE";
  const env = (args.env ?? {}) as Record<string, unknown>;
  const kv = env[binding] as KvLike | undefined;
  return createKvDataCacheAdapter({
    ...args,
    env: kv ? { ...env, [binding]: failOpenKv(kv) } : env,
  } as Args);
}
