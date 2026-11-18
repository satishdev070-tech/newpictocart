import { describe, expect, it, vi } from "vitest";
import { failOpenKv, type KvLike } from "@/lib/cache/fail-open-kv";

const quota = () => Promise.reject(new Error("KV get() limit exceeded for the day."));

function fakeKv(over: Partial<KvLike> = {}): KvLike {
  return {
    get: vi.fn(async (k: string | string[]) => (Array.isArray(k) ? new Map(k.map((x) => [x, "v"])) : "v")),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    ...over,
  };
}

describe("failOpenKv (data cache survives KV quota errors)", () => {
  it("passes through when KV works", async () => {
    const kv = failOpenKv(fakeKv(), { log: () => {} });
    expect(await kv.get("a")).toBe("v");
    expect(await kv.get("a", { cacheTtl: 60 })).toBe("v");
  });

  it("turns a failed read into a miss (single and multi-key) instead of throwing", async () => {
    const kv = failOpenKv(fakeKv({ get: vi.fn(quota) }), { log: () => {} });
    expect(await kv.get("a")).toBeNull();
    expect(await kv.get(["a", "b"])).toEqual(new Map([["a", null], ["b", null]]));
  });

  it("skips failed writes and deletes", async () => {
    const kv = failOpenKv(fakeKv({ put: vi.fn(quota), delete: vi.fn(quota) }), { log: () => {} });
    await expect(kv.put("a", "x")).resolves.toBeUndefined();
    await expect(kv.delete("a")).resolves.toBeUndefined();
  });

  it("stops calling KV for the cooldown after a failure, then retries", async () => {
    let t = 0;
    const get = vi.fn(quota);
    const log = vi.fn();
    const kv = failOpenKv(fakeKv({ get }), { cooldownMs: 1000, now: () => t, log });
    await kv.get("a");
    await kv.get("b");
    expect(get).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    t = 1001;
    await kv.get("c");
    expect(get).toHaveBeenCalledTimes(2);
  });
});
