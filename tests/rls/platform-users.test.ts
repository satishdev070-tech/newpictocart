import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, as, closePool, one, rejects, superuser, user } from "./db";

afterAll(closePool);

type Q = Parameters<Parameters<typeof as>[1]>[0];

/** Switch the caller inside one superuser transaction (data set up earlier stays visible). */
async function become(q: Q, userId: string) {
  await q("reset role");
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await q("set local role authenticated");
}

const admin = user(USERS.platformAdmin);
const aOwner = user(USERS.aanganOwner);

describe("platform permission seeds (migration 3700)", () => {
  it("super_admin and finance get the finance keys; only super_admin manages partners", async () => {
    const rows = await as(superuser, (q) => q<{ role: string; permission: string }>("select role, permission from platform_role_permissions where permission in ('platform.finance.read','platform.finance.manage','platform.partners.manage') order by 1, 2"));
    expect(rows.map((r) => `${r.role}:${r.permission}`)).toEqual([
      "finance:platform.finance.manage",
      "finance:platform.finance.read",
      "super_admin:platform.finance.manage",
      "super_admin:platform.finance.read",
      "super_admin:platform.partners.manage",
    ]);
  });
});

describe("user directory", () => {
  it("lists every account with its types and store memberships", async () => {
    const rows = await as(admin, (q) => q<{ user_id: string; user_types: string[]; stores: { tenantId: string; role: string }[]; total_count: string }>("select * from public.platform_user_directory(null, null, null, 200, 0)"));
    const byId = new Map(rows.map((r) => [r.user_id, r]));
    expect(byId.get(USERS.platformAdmin)?.user_types).toContain("platform");
    expect(byId.get(USERS.aanganOwner)?.user_types).toContain("seller");
    expect(byId.get(USERS.aanganOwner)?.stores.map((s) => s.tenantId)).toContain(TENANTS.aangan);
    expect(Number(one(rows).total_count)).toBe(rows.length);
  });

  it("filters by search, type and store", async () => {
    await as(admin, async (q) => {
      const byEmail = await q<{ user_id: string }>("select user_id from public.platform_user_directory('owner@aangan', null, null, 50, 0)");
      expect(byEmail.map((r) => r.user_id)).toEqual([USERS.aanganOwner]);
      const byStore = await q<{ user_id: string }>("select user_id from public.platform_user_directory(null, null, $1, 50, 0)", [TENANTS.rangrez]);
      expect(byStore.map((r) => r.user_id)).toContain(USERS.rangrezOwner);
      expect(byStore.map((r) => r.user_id)).not.toContain(USERS.aanganOwner);
      const staff = await q<{ user_id: string }>("select user_id from public.platform_user_directory(null, 'platform', null, 50, 0)");
      expect(staff.map((r) => r.user_id)).toEqual([USERS.platformAdmin]);
      await rejects(q("select * from public.platform_user_directory(null, 'robot', null, 50, 0)"), /unknown type/);
    });
  });

  it("stats and detail include stores, shopper records and the audit trail", async () => {
    await as(superuser, async (q) => {
      await q("insert into audit_logs (actor_user_id, actor_type, action, entity_type, entity_id) values ($1, 'user', 'product.created', 'product', 'x')", [USERS.aanganOwner]);
      await become(q, USERS.platformAdmin);
      const stats = one(await q<{ total: string; platform: string; sellers: string }>("select * from public.platform_user_stats()"));
      expect(Number(stats.total)).toBeGreaterThanOrEqual(5);
      expect(Number(stats.platform)).toBe(1);
      expect(Number(stats.sellers)).toBeGreaterThanOrEqual(2);
      const d = one(await q<{ v: { email: string; stores: { tenantId: string }[]; audit: { action: string; asActor: boolean }[]; signIns: unknown[] } }>("select public.platform_user_detail($1) as v", [USERS.aanganOwner])).v;
      expect(d.email).toBe("owner@aangan.test");
      expect(d.stores.map((s) => s.tenantId)).toContain(TENANTS.aangan);
      expect(d.audit.some((a) => a.action === "product.created" && a.asActor)).toBe(true);
      expect(d.signIns).toEqual([]);
      const missing = one(await q<{ v: unknown }>("select public.platform_user_detail('00000000-0000-4000-a000-0000000000ff') as v"));
      expect(missing.v).toBeNull();
    });
  });

  it("is platform.users.manage only (support staff and sellers are refused)", async () => {
    await rejects(as(aOwner, (q) => q("select * from public.platform_user_directory(null, null, null, 10, 0)")), /not permitted/);
    await rejects(as(aOwner, (q) => q("select public.platform_user_detail($1)", [USERS.platformAdmin])), /not permitted/);
    await as(superuser, async (q) => {
      await q("insert into platform_memberships (user_id, role) values ($1, 'support')", [USERS.shopper]);
      await become(q, USERS.shopper);
      await rejects(q("select * from public.platform_user_stats()"), /not permitted/);
      await rejects(q("select * from public.platform_user_directory(null, null, null, 10, 0)"), /not permitted/);
    });
  });
});
