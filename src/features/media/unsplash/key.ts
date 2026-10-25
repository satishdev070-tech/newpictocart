import "server-only";
import { cache } from "react";
import { logger } from "@/lib/observability/logger";
import { getAppCredential } from "@/features/platform-apps/server";

/**
 * The Unsplash Access Key: the one saved in Admin → Media library (encrypted in
 * platform_app_credentials) wins, UNSPLASH_ACCESS_KEY is the fallback. Server only; the key is
 * sent to api.unsplash.com in the Authorization header and never reaches the browser.
 * Never throws: any failure to read the saved key falls back to the env var.
 */
export const getUnsplashAccessKey = cache(async (): Promise<string | null> => {
  try {
    return (await getAppCredential("unsplash"))?.secret?.trim() || null;
  } catch (error) {
    logger.warn("unsplash.key_read_failed", { error: error instanceof Error ? error.message : "unknown" });
    return process.env.UNSPLASH_ACCESS_KEY?.trim() || null;
  }
});

export type UnsplashKeyTest =
  | { ok: true; mode: "demo" | "production" | "unknown"; limit: number | null; remaining: number | null }
  | { ok: false; reason: "invalid" | "rate_limited" | "unavailable"; status: number | null };

/** Unsplash allows 50 requests/hour in demo mode; approved (production) apps get 5,000. */
export function unsplashMode(limit: number | null): "demo" | "production" | "unknown" {
  if (limit === null) return "unknown";
  return limit <= 50 ? "demo" : "production";
}

const num = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : null);

/**
 * Checks a key with one lightweight API call (GET /photos?per_page=1) and reads the rate-limit
 * headers. Uses one request of the hourly allowance; not cached.
 */
export async function testUnsplashKey(key: string, fetchImpl: typeof fetch = fetch): Promise<UnsplashKeyTest> {
  let res: Response;
  try {
    res = await fetchImpl("https://api.unsplash.com/photos?per_page=1", {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "unavailable", status: null };
  }
  const limit = num(res.headers.get("x-ratelimit-limit"));
  const remaining = num(res.headers.get("x-ratelimit-remaining"));
  if (res.ok) return { ok: true, mode: unsplashMode(limit), limit, remaining };
  if (res.status === 401) return { ok: false, reason: "invalid", status: 401 };
  if (res.status === 403 && remaining === 0) return { ok: false, reason: "rate_limited", status: 403 };
  if (res.status === 403) return { ok: false, reason: "invalid", status: 403 };
  return { ok: false, reason: "unavailable", status: res.status };
}

export function describeUnsplashTest(t: UnsplashKeyTest): string {
  if (t.ok) {
    const left = t.remaining !== null && t.limit !== null ? ` ${t.remaining} of ${t.limit} requests left this hour.` : "";
    const mode = t.mode === "demo" ? " Demo mode (50 requests/hour): apply for production in your Unsplash app to raise it." : t.mode === "production" ? " Production mode." : "";
    return `Connected to Unsplash.${mode}${left}`;
  }
  if (t.reason === "invalid") return "Unsplash rejected this key. Use the Access Key (not the Secret key) from your app at unsplash.com/oauth/applications.";
  if (t.reason === "rate_limited") return "The key works, but this hour's request limit is used up. Try again later.";
  return `Couldn't reach Unsplash${t.status ? ` (HTTP ${t.status})` : ""}. Try again in a minute.`;
}
