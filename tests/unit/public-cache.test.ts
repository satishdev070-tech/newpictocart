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
  const mod = await import("@/lib/cache/public-cache");
  mod.resetPublicCachePrefixesForTests();
  return mod;
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

describe("public cache", () => {
  it("is bypassed outside production", async () => {
    const { cachedPublic } = await load("development");
    const fn = vi.fn(async () => "live");
    const cached = cachedPublic("landing", fn, { tags: ["platform-landing"], revalidateSeconds: 300, keyPrefix: "pub:v1" });
    expect(cached).toBe(fn);
    await expect(cached()).resolves.toBe("live");
    expect(unstableCache).not.toHaveBeenCalled();
  });

  it("wraps with unstable_cache tags and TTL in production", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    const { cachedPublic } = await load("production");
    const fn = vi.fn(async () => ({ ok: true }));
    const cached = cachedPublic("platform-product-types", fn, {
      tags: ["platform-product-types"],
      revalidateSeconds: 600,
      keyPrefix: "pub:v1",
    });
    await expect(cached()).resolves.toEqual({ ok: true });
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ["pub:v1", "platform-product-types"], {
      tags: ["platform-product-types"],
      revalidate: 600,
    });
  });

  it("does not call Redis when Upstash is unset", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    const { cachedPublic } = await load("production", false);
    const fn = vi.fn(async () => "db");
    const cached = cachedPublic("x", fn, { tags: ["t"], revalidateSeconds: 60, keyPrefix: "pub:v1" });
    await expect(cached()).resolves.toBe("db");
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("L2 miss loads fn and writes Redis; L2 hit skips fn", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ v: "from-redis" });
    const { cachedPublic, redisEntryKey } = await load("production", true);
    const fn = vi.fn(async () => "from-db");
    const cached = cachedPublic("feature-flag-defaults", fn, {
      tags: ["platform-feature-flag-defaults"],
      revalidateSeconds: 300,
      keyPrefix: "pub:v1",
    });

    await expect(cached()).resolves.toBe("from-db");
    expect(fn).toHaveBeenCalledOnce();
    expect(redisGet).toHaveBeenCalledWith(redisEntryKey("pub:v1", "feature-flag-defaults", []));
    expect(redisPipeline).toHaveBeenCalled();
    expect(redisSadd).toHaveBeenCalledWith(`pub:v1:idx:${encodeURIComponent("platform-feature-flag-defaults")}`, redisEntryKey("pub:v1", "feature-flag-defaults", []));

    await expect(cached()).resolves.toBe("from-redis");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("fails open when Redis get throws", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    redisGet.mockRejectedValueOnce(new Error("redis down"));
    const { cachedPublic } = await load("production", true);
    const fn = vi.fn(async () => "ok");
    const cached = cachedPublic("x", fn, { tags: ["t"], revalidateSeconds: 60, keyPrefix: "pub:v1" });
    await expect(cached()).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("treats a hung Redis get as a miss and still resolves from fn", async () => {
    unstableCache.mockImplementation((fn: () => Promise<unknown>) => fn);
    // Never resolves — without a timeout this would hang cachedPublic forever.
    redisGet.mockReturnValueOnce(new Promise(() => undefined));
    const { cachedPublic, REDIS_OP_TIMEOUT_MS, withTimeout } = await load("production", true);

    await expect(withTimeout(new Promise(() => undefined), 20)).rejects.toThrow("timeout");

    const fn = vi.fn(async () => "from-db-after-timeout");
    const cached = cachedPublic("hung-get", fn, { tags: ["t"], revalidateSeconds: 60, keyPrefix: "pub:v1" });
    const started = Date.now();
    await expect(cached()).resolves.toBe("from-db-after-timeout");
    const elapsed = Date.now() - started;
    expect(fn).toHaveBeenCalledOnce();
    // Must finish shortly after the Redis op timeout (not hang).
    expect(elapsed).toBeLessThan(REDIS_OP_TIMEOUT_MS + 500);
    expect(elapsed).toBeGreaterThanOrEqual(REDIS_OP_TIMEOUT_MS - 50);
  });

  it("revalidatePublicTags drops L1 tag and deletes indexed Redis keys", async () => {
    redisSmembers.mockResolvedValue(["pub:v1:e:custom-themes:"]);
    const { cachedPublic, revalidatePublicTags, redisTagIndexKey } = await load("production", true);
    // Register pub:v1 via a cachedPublic definition.
    cachedPublic("noop", async () => null, { tags: ["marketplace-custom-themes"], revalidateSeconds: 300, keyPrefix: "pub:v1" });

    revalidatePublicTags("marketplace-custom-themes");
    expect(revalidateTag).toHaveBeenCalledWith("marketplace-custom-themes", { expire: 0 });
    const index = redisTagIndexKey("pub:v1", "marketplace-custom-themes");
    await vi.waitFor(() => expect(redisSmembers).toHaveBeenCalledWith(index));
    await vi.waitFor(() => expect(redisDel).toHaveBeenCalledWith("pub:v1:e:custom-themes:", index));
  });
});
