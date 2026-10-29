import { beforeEach, describe, expect, it, vi } from "vitest";

let serverClient: unknown = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (typeof serverClient === "function") return (serverClient as () => unknown)();
    if (serverClient instanceof Error) throw serverClient;
    return serverClient;
  },
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  serverClient = null;
});

describe("getSessionUser resilience", () => {
  it("returns null when getClaims throws", async () => {
    serverClient = {
      auth: { getClaims: async () => {
        throw new Error("network down");
      } },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    };
    const { getSessionUser } = await import("@/lib/auth/session");
    expect(await getSessionUser()).toBeNull();
  });

  it("rethrows Next.js dynamic-server bailouts so routes stay dynamic", async () => {
    const bailout = Object.assign(new Error("Dynamic server usage: cookies"), { digest: "DYNAMIC_SERVER_USAGE" });
    serverClient = bailout;
    const { getSessionUser } = await import("@/lib/auth/session");
    await expect(getSessionUser()).rejects.toBe(bailout);
  });

  it("returns the user when claims and profile are healthy", async () => {
    serverClient = {
      auth: { getClaims: async () => ({ data: { claims: { sub: "u1", email: "a@example.com" } }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "A", status: "active" } }) }) }) }),
    };
    const { getSessionUser } = await import("@/lib/auth/session");
    expect(await getSessionUser()).toEqual({ id: "u1", email: "a@example.com", displayName: "A" });
  });
});

describe("landingPathFor resilience", () => {
  it("falls back to /start when membership lookups throw", async () => {
    serverClient = new Error("db unavailable");
    const { landingPathFor } = await import("@/lib/auth/landing");
    expect(await landingPathFor("u1")).toBe("/start");
  });

  it("routes sellers to the dashboard when they have an active membership", async () => {
    serverClient = {
      from: (table: string) => {
        if (table === "tenant_memberships") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ count: 1, error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        };
      },
    };
    const { landingPathFor } = await import("@/lib/auth/landing");
    expect(await landingPathFor("u1")).toBe("/dashboard");
  });
});
