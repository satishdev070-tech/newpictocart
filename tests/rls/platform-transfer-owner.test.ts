import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, anon, as, closePool, rejects, superuser, user } from "./db";

afterAll(closePool);

type Q = Parameters<Parameters<typeof as>[1]>[0];

const SQL = "select public.platform_transfer_tenant_owner($1, $2, $3, $4)";

/** Inside a superuser transaction: act as `userId` for one statement, then return to postgres. */
async function asUser(q: Q, userId: string, sql: string, params: unknown[]) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await q("set local role authenticated");
  try {
    return await q(sql, params);
  } finally {
    await q("reset role");
  }
}

async function members(q: Q, tenantId: string) {
  return q<{ user_id: string; role: string; status: string }>("select user_id, role, status from tenant_memberships where tenant_id = $1 order by role, user_id", [tenantId]);
}

describe("platform_transfer_tenant_owner (migration 8400)", () => {
  it("platform admin moves ownership to another account and removes the previous owner", async () => {
    await as(superuser, async (q) => {
      await asUser(q, USERS.platformAdmin, SQL, [TENANTS.aangan, USERS.rangrezOwner, true, "Seller asked to move the store"]);
      const rows = await members(q, TENANTS.aangan);
      const owners = rows.filter((r) => r.role === "owner");
      expect(owners).toEqual([{ user_id: USERS.rangrezOwner, role: "owner", status: "active" }]);
      expect(rows.some((r) => r.user_id === USERS.aanganOwner)).toBe(false);
      // Other members are untouched.
      expect(rows.some((r) => r.user_id === USERS.aanganStaff)).toBe(true);

      const audit = await q<{ action: string; actor_type: string; metadata: { previous_owners: string[]; previous: string } }>(
        "select action, actor_type, metadata from audit_logs where tenant_id = $1 and action = 'tenant.owner_transferred' order by created_at desc limit 1",
        [TENANTS.aangan],
      );
      expect(audit[0]?.actor_type).toBe("platform");
      expect(audit[0]?.metadata.previous_owners).toEqual([USERS.aanganOwner]);
      expect(audit[0]?.metadata.previous).toBe("removed");
    });
  });

  it("keeps the previous owner as a manager when asked, and upgrades an existing member", async () => {
    await as(superuser, async (q) => {
      // aanganStaff is already a member: they become owner, the old owner becomes manager.
      await asUser(q, USERS.platformAdmin, SQL, [TENANTS.aangan, USERS.aanganStaff, false, "Owner handing over day-to-day"]);
      const rows = await members(q, TENANTS.aangan);
      expect(rows.find((r) => r.user_id === USERS.aanganStaff)?.role).toBe("owner");
      expect(rows.find((r) => r.user_id === USERS.aanganOwner)?.role).toBe("manager");
      expect(rows.filter((r) => r.role === "owner")).toHaveLength(1);
    });
  });

  it("rejects the current owner, unknown accounts and unknown stores", async () => {
    await as(superuser, async (q) => {
      await rejects(asUser(q, USERS.platformAdmin, SQL, [TENANTS.aangan, USERS.aanganOwner, true, null]), /already the owner/);
      await rejects(asUser(q, USERS.platformAdmin, SQL, [TENANTS.aangan, "00000000-0000-4000-a000-0000000000ff", true, null]), /user not found/);
      await rejects(asUser(q, USERS.platformAdmin, SQL, ["10000000-0000-4000-a000-0000000000ff", USERS.rangrezOwner, true, null]), /store not found/);
      // Nothing changed.
      expect((await members(q, TENANTS.aangan)).filter((r) => r.role === "owner").map((r) => r.user_id)).toEqual([USERS.aanganOwner]);
    });
  });

  it("store owners, other sellers and anonymous callers can't transfer", async () => {
    await rejects(as(user(USERS.aanganOwner), (q) => q(SQL, [TENANTS.aangan, USERS.rangrezOwner, true, null])), /not allowed/);
    await rejects(as(user(USERS.rangrezOwner), (q) => q(SQL, [TENANTS.aangan, USERS.rangrezOwner, true, null])), /not allowed/);
    await rejects(as(anon, (q) => q(SQL, [TENANTS.aangan, USERS.rangrezOwner, true, null])), /permission denied/);
  });
});
