import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rpc: vi.fn() }));
const cfg = vi.hoisted(() => ({ firstPartyAnalytics: true }));
const limit = vi.hoisted(() => ({ rateLimit: vi.fn(), clientIpKey: vi.fn(async () => "ip") }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => ({ rpc: db.rpc }) }));
vi.mock("@/features/platform/server/public-config", () => ({ getPublicPlatformConfig: async () => cfg }));
vi.mock("@/lib/rate-limit", () => limit);
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "@/app/api/analytics/pageview/route";

const SID = "0b8a3f9e-6c1d-4f2a-9b7e-3d5c1a2b4e6f";
const post = (host: string | null, body: unknown) => {
  const headers = new Headers({ "content-type": "text/plain" });
  if (host) headers.set("x-paliya-host", host);
  return POST(new Request("https://internal/api/analytics/pageview", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxxxxxx");
  vi.stubEnv("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN", "pictocart.in");
  db.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  limit.rateLimit.mockReset().mockResolvedValue(undefined);
  cfg.firstPartyAnalytics = true;
});

describe("page view ingest", () => {
  it("records a view from a platform host with path only", async () => {
    const res = await post("www.pictocart.in", { sid: SID, path: "/pricing?utm_source=x", ref: "https://www.google.com/search?q=x" });
    expect(res.status).toBe(204);
    expect(db.rpc).toHaveBeenCalledWith("record_platform_page_view", { p_session: SID, p_path: "/pricing", p_referrer: "https://www.google.com/search", p_host: "www.pictocart.in" });
    expect(limit.rateLimit).toHaveBeenCalledWith("platform-pageview", "ip", 120, 60);
  });

  it("ignores store hosts, unknown hosts, admin paths, junk and disabled tracking", async () => {
    await post("acme.pictocart.in", { sid: SID, path: "/" });
    await post(null, { sid: SID, path: "/" });
    await post("www.pictocart.in", { sid: SID, path: "/admin/analytics" });
    await post("www.pictocart.in", "not json");
    await post("www.pictocart.in", { sid: "x", path: "/" });
    cfg.firstPartyAnalytics = false;
    await post("www.pictocart.in", { sid: SID, path: "/" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("drops views when rate limited and stays 204 when the table is missing", async () => {
    limit.rateLimit.mockRejectedValueOnce(new Error("RATE_LIMITED"));
    expect((await post("www.pictocart.in", { sid: SID, path: "/" })).status).toBe(204);
    expect(db.rpc).not.toHaveBeenCalled();
    db.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await post("www.pictocart.in", { sid: SID, path: "/" })).status).toBe(204);
  });
});
