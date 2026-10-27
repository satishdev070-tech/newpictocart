import { afterEach, describe, expect, it, vi } from "vitest";

const unstableCache = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ unstable_cache: unstableCache, revalidateTag }));

const redisGet = vi.fn();
const redisSet = vi.fn();
const redisSmembers = vi.fn();
const redisDel = vi.fn();
const redisPipeline = vi.fn();
const redisExpire = vi.fn();
const redisSadd = vi.fn();

function mockRedis(enabled: boolean) {
  if (!enabled) {
    vi.doMock("@/lib/cache/redis", () => ({ getRedis: () => null, resetRedisClientForTests: () => undefined }));
    return;
  }
  const pipe = {
    set: redisSet,
    sadd: redisSadd,
    expire: redisExpire,
    exec: vi.fn(async () => []),
  };
  redisPipeline.mockReturnValue(pipe);
  vi.doMock("@/lib/cache/redis", () => ({
    getRedis: () => ({
      get: redisGet,
      set: redisSet,
      smembers: redisSmembers,
      del: redisDel,
      pipeline: redisPipeline,
    }),
    resetRedisClientForTests: () => undefined,
  }));
}

async function load(env: string, withRedis = false) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env);
  mockRedis(withRedis);
  return import("@/lib/cache/storefront");
}

afterEach(() => {
  vi.unstubAllEnvs();
  unstableCache.mockReset();
  revalidateTag.mockReset();
  redisGet.mockReset();
  redisSet.mockReset();
  redisSmembers.mockReset();
  redisDel.mockReset();
  redisPipeline.mockReset();
  redisExpire.mockReset();
  redisSadd.mockReset();
});

describe("storefront cache", () => {
  it("is bypassed outside production (next dev always reads the DB)", async () => {
    const { cachedStorefront } = await load("development");
    const fn = vi.fn(async (id: string) => `v-${id}`);
    const cached = cachedStorefront("x", fn, (id) => [id]);
    expect(cached).toBe(fn);
    await expect(cached("t1")).resolves.toBe("v-t1");
    expect(unstableCache).not.toHaveBeenCalled();
  });

  it("caches per argument with the tenant tag, the global tag and a TTL", async () => {
    unstableCache.mockImplementation((fn: (...a: string[]) => Promise<unknown>) => fn);
    const { cachedStorefront, storefrontTag, ALL_STOREFRONTS_TAG, STOREFRONT_CACHE_SECONDS } = await load("production");
    const fn = vi.fn(async (id: string) => `v-${id}`);
    const cached = cachedStorefront("store-profile", fn, (id) => [storefrontTag(id)]);
    await expect(cached("tenant-a")).resolves.toBe("v-tenant-a");
    await expect(cached("tenant-b")).resolves.toBe("v-tenant-b");
    expect(fn).toHaveBeenNthCalledWith(1, "tenant-a");
    expect(fn).toHaveBeenNthCalledWith(2, "tenant-b");
    expect(unstableCache).toHaveBeenCalledTimes(2);
    expect(unstableCache.mock.calls[0]?.[1]).toEqual(["sf", "store-profile"]);
    expect(unstableCache.mock.calls[0]?.[2]).toEqual({
      tags: [ALL_STOREFRONTS_TAG, "tenant:tenant-a:storefront"],
      revalidate: STOREFRONT_CACHE_SECONDS,
    });
    expect(unstableCache.mock.calls[1]?.[2].tags).toContain("tenant:tenant-b:storefront");
  });

  it("does not call Redis when Upstash env is unset", async () => {
    unstableCache.mockImplementation((fn: (...a: string[]) => Promise<unknown>) => fn);
    const { cachedStorefront, storefrontTag } = await load("production", false);
    const fn = vi.fn(async (id: string) => `v-${id}`);
    const cached = cachedStorefront("store-profile", fn, (id) => [storefrontTag(id)]);
    await expect(cached("t1")).resolves.toBe("v-t1");
    expect(redisGet).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("reads and writes Redis L2 around the loader when configured", async () => {
    unstableCache.mockImplementation((fn: (...a: string[]) => Promise<unknown>) => fn);
    redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ v: "from-redis" });
    const { cachedStorefront, storefrontTag, redisEntryKey } = await load("production", true);
    const fn = vi.fn(async (id: string) => `db-${id}`);
    const cached = cachedStorefront("store-profile", fn, (id) => [storefrontTag(id)]);

    await expect(cached("t1")).resolves.toBe("db-t1");
    expect(fn).toHaveBeenCalledOnce();
    expect(redisGet).toHaveBeenCalledWith(redisEntryKey("store-profile", ["t1"]));
    expect(redisPipeline).toHaveBeenCalled();

    await expect(cached("t1")).resolves.toBe("from-redis");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("revalidates only the tenant immediately; the host directory only on domain changes", async () => {
    redisSmembers.mockResolvedValue([]);
    const { revalidateStorefront, revalidateTenantDirectory, revalidateAllStorefronts } = await load("production", true);
    revalidateStorefront("t1");
    expect(revalidateTag).toHaveBeenCalledWith("tenant:t1:storefront", { expire: 0 });
    expect(revalidateTag).not.toHaveBeenCalledWith("tenant-directory", expect.anything());
    await vi.waitFor(() => expect(redisSmembers).toHaveBeenCalledWith("sf:v1:idx:t:t1"));

    revalidateTenantDirectory();
    expect(revalidateTag).toHaveBeenCalledWith("tenant-directory", { expire: 0 });
    await vi.waitFor(() => expect(redisSmembers).toHaveBeenCalledWith("sf:v1:idx:dir"));

    revalidateAllStorefronts();
    expect(revalidateTag).toHaveBeenCalledWith("storefront-all", { expire: 0 });
    await vi.waitFor(() => expect(redisSmembers).toHaveBeenCalledWith("sf:v1:idx:all"));
  });

  it("deletes indexed Redis keys on tenant revalidate", async () => {
    redisSmembers.mockResolvedValue(["sf:v1:e:store-profile:t1", "sf:v1:e:site-mode:t1"]);
    const { revalidateStorefront } = await load("production", true);
    revalidateStorefront("t1");
    await vi.waitFor(() =>
      expect(redisDel).toHaveBeenCalledWith("sf:v1:e:store-profile:t1", "sf:v1:e:site-mode:t1", "sf:v1:idx:t:t1"),
    );
  });
});
