import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code: string; message: string } | null };
let results: Result[] = [];
const selects: string[] = [];
let activeCookie: string | undefined;

function chain(sel: string) {
  selects.push(sel);
  const res = results.shift() ?? { data: [], error: null };
  const c: Record<string, unknown> = {};
  for (const k of ["eq", "order"]) c[k] = () => c;
  c.overrideTypes = () => Promise.resolve(res);
  return c;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: () => ({ select: (s: string) => chain(s) }) }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (activeCookie ? { value: activeCookie } : undefined) }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { to });
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "u1", email: "a@example.com", displayName: null }) }));
vi.mock("@/lib/auth/landing", () => ({ landingPathFor: async () => "/start" }));

const row = (id: string, type?: string) => ({
  role: "owner",
  tenant_id: id,
  tenants: { id, name: `Store ${id}`, slug: `s-${id}`, status: "active", ...(type ? { website_type: type } : {}) },
  tenant_custom_roles: null,
});

beforeEach(() => {
  vi.resetModules();
  results = [];
  selects.length = 0;
  activeCookie = undefined;
});

describe("session payload: websiteType", () => {
  it("selects website_type and exposes it on memberships and the store context", async () => {
    results = [{ data: [row("t1", "ONLINE_STORE")], error: null }];
    const { requireTenant } = await import("@/lib/tenant/membership");
    const ctx = await requireTenant();
    expect(selects[0]).toContain("website_type");
    expect(ctx.websiteType).toBe("ONLINE_STORE");
    expect(ctx.memberships[0]?.websiteType).toBe("ONLINE_STORE");
  });

  it("falls back to the old select when the column does not exist yet (migration not applied)", async () => {
    results = [
      { data: null, error: { code: "42703", message: "column tenants_1.website_type does not exist" } },
      { data: [row("t1")], error: null },
    ];
    const { listMemberships } = await import("@/lib/tenant/membership");
    const ms = await listMemberships("u1");
    expect(selects).toHaveLength(2);
    expect(selects[1]).not.toContain("website_type");
    expect(ms[0]?.websiteType).toBe("ONLINE_STORE");
  });

  it("other database errors still fail", async () => {
    results = [{ data: null, error: { code: "57014", message: "timeout" } }];
    const { listMemberships } = await import("@/lib/tenant/membership");
    await expect(listMemberships("u1")).rejects.toThrow();
    expect(selects).toHaveLength(1);
  });

  it("StoreRouteGuard: an active Informative tenant is sent to its own panel", async () => {
    results = [{ data: [row("t1", "INFORMATIVE")], error: null }];
    const { requireTenant } = await import("@/lib/tenant/membership");
    await expect(requireTenant()).rejects.toMatchObject({ to: "/informative/dashboard" });
  });

  it("StoreRouteGuard follows the active store, not the first one", async () => {
    results = [{ data: [row("t1", "INFORMATIVE"), row("t2", "ONLINE_STORE")], error: null }];
    activeCookie = "t2";
    const { requireTenant } = await import("@/lib/tenant/membership");
    const ctx = await requireTenant();
    expect(ctx.tenantId).toBe("t2");
  });
});
