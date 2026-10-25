import { describe, expect, it, vi } from "vitest";
import { describeUnsplashTest, testUnsplashKey, unsplashMode } from "@/features/media/unsplash/key";
import { unsplashKeySchema } from "@/features/media/unsplash/key-schema";
import { resolveCredential } from "@/features/platform-apps/core";

const KEY = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCD";
const reply = (status: number, headers: Record<string, string> = {}) => vi.fn(async () => new Response("[]", { status, headers })) as unknown as typeof fetch;

describe("testUnsplashKey", () => {
  it("sends the key only in the Authorization header and reads the rate limit", async () => {
    const f = reply(200, { "x-ratelimit-limit": "50", "x-ratelimit-remaining": "49" });
    const r = await testUnsplashKey(KEY, f);
    expect(r).toEqual({ ok: true, mode: "demo", limit: 50, remaining: 49 });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.unsplash.com/photos?per_page=1");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Client-ID ${KEY}`);
    expect(describeUnsplashTest(r)).toContain("Demo mode");
  });
  it("recognises production, invalid keys, exhausted limits and outages", async () => {
    expect(await testUnsplashKey(KEY, reply(200, { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4999" }))).toMatchObject({ ok: true, mode: "production" });
    expect(await testUnsplashKey(KEY, reply(401))).toEqual({ ok: false, reason: "invalid", status: 401 });
    expect(await testUnsplashKey(KEY, reply(403, { "x-ratelimit-remaining": "0" }))).toEqual({ ok: false, reason: "rate_limited", status: 403 });
    expect(await testUnsplashKey(KEY, reply(503))).toEqual({ ok: false, reason: "unavailable", status: 503 });
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await testUnsplashKey(KEY, down)).toEqual({ ok: false, reason: "unavailable", status: null });
    expect(describeUnsplashTest({ ok: false, reason: "invalid", status: 401 })).toContain("Access Key (not the Secret key)");
  });
  it("labels the mode from the hourly limit", () => {
    expect(unsplashMode(50)).toBe("demo");
    expect(unsplashMode(5000)).toBe("production");
    expect(unsplashMode(null)).toBe("unknown");
  });
});

describe("unsplash key input", () => {
  it("accepts an Access Key and rejects junk", () => {
    expect(unsplashKeySchema.parse({ accessKey: `  ${KEY} ` }).accessKey).toBe(KEY);
    expect(unsplashKeySchema.safeParse({ accessKey: "short" }).success).toBe(false);
    expect(unsplashKeySchema.safeParse({ accessKey: `${KEY} extra` }).success).toBe(false);
  });
});

describe("unsplash credential resolution", () => {
  const decrypt = (ct: string) => ct.replace("enc:", "");
  it("prefers the key saved in the console and falls back to UNSPLASH_ACCESS_KEY", () => {
    expect(resolveCredential("unsplash", { client_id: null, secret_ciphertext: "enc:db-key-123456", extra: {} }, decrypt, { UNSPLASH_ACCESS_KEY: "env-key-123456" })).toMatchObject({ secret: "db-key-123456", source: "db" });
    expect(resolveCredential("unsplash", null, decrypt, { UNSPLASH_ACCESS_KEY: "env-key-123456" })).toMatchObject({ secret: "env-key-123456", source: "env" });
    expect(resolveCredential("unsplash", null, decrypt, {})).toBeNull();
  });
});
