import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims },
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  getClaims.mockReset();
});

describe("proxy session refresh resilience", () => {
  it("still serves the platform route when getClaims throws for an auth cookie", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN", "pictocart.in");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "https://www.pictocart.in");
    getClaims.mockRejectedValue(new Error("jwt refresh failed"));

    const { proxy } = await import("@/proxy");
    const req = new NextRequest("https://www.pictocart.in/seller/login", {
      headers: {
        host: "www.pictocart.in",
        cookie: "sb-abc-auth-token=corrupt.jwt.value",
      },
    });
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(getClaims).toHaveBeenCalled();
  });
});
