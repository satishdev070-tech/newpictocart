import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/** getRedis loads the Upstash SDK only when Redis is configured (Worker CPU budget, Error 1102). */
describe("getRedis lazy SDK load", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@upstash/redis");
  });

  async function load() {
    const ctor = vi.fn();
    vi.doMock("@upstash/redis", () => {
      ctor();
      return { Redis: class { constructor(public opts: unknown) {} } };
    });
    const mod = await import("@/lib/cache/redis");
    mod.resetRedisClientForTests();
    return { mod, ctor };
  }

  it("never loads the SDK when env is incomplete", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { mod, ctor } = await load();
    expect(await mod.getRedis()).toBeNull();
    expect(ctor).not.toHaveBeenCalled();
  });

  it("loads the SDK once and memoises the client when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const { mod, ctor } = await load();
    const a = await mod.getRedis();
    const b = await mod.getRedis();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it("has no static value import of the SDK", () => {
    const src = readFileSync("src/lib/cache/redis.ts", "utf8");
    expect(src).not.toMatch(/^import\s+(?!type\b)[^;]*["']@upstash\/redis["']/m);
  });
});
