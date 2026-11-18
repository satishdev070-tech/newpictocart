import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, as, closePool, rejects } from "./db";

afterAll(closePool);

/**
 * Voice assistant (docs/voice-assistant/PLAN.md): a member only sees and writes their OWN
 * conversations in a store they belong to; other members and other stores are invisible;
 * messages are append-only; only theme.edit holders can move an action's status.
 */
const owner = { role: "authenticated" as const, userId: USERS.aanganOwner };
const staff = { role: "authenticated" as const, userId: USERS.aanganStaff }; // sales_associate (no theme.edit)
const otherOwner = { role: "authenticated" as const, userId: USERS.rangrezOwner };

type Row = { id: string };

describe("assistant_sessions / messages / actions RLS", () => {
  it("a member creates and reads their own session and messages", async () => {
    await as(owner, async (q) => {
      const [s] = await q<Row>("insert into assistant_sessions (tenant_id, user_id, locale) values ($1, $2, 'hinglish') returning id", [TENANTS.aangan, USERS.aanganOwner]);
      await q("insert into assistant_messages (session_id, tenant_id, user_id, role, content, locale) values ($1, $2, $3, 'user', 'Mere store ka colour maroon kar do', 'hinglish')", [s!.id, TENANTS.aangan, USERS.aanganOwner]);
      expect(await q("select id from assistant_messages where session_id = $1", [s!.id])).toHaveLength(1);
    });
  });

  it("cannot create a session for another user or another store (no trusting client tenant ids)", async () => {
    await as(owner, async (q) => {
      await rejects(q("insert into assistant_sessions (tenant_id, user_id) values ($1, $2)", [TENANTS.aangan, USERS.aanganStaff]), /row-level security/);
      await rejects(q("insert into assistant_sessions (tenant_id, user_id) values ($1, $2)", [TENANTS.rangrez, USERS.aanganOwner]), /row-level security/);
    });
  });

  it("other members of the same store and other stores can't see or write into a session", async () => {
    const sessionId = await as({ role: "postgres" }, async (q) => {
      const [s] = await q<Row>("insert into assistant_sessions (tenant_id, user_id) values ($1, $2) returning id", [TENANTS.aangan, USERS.aanganOwner]);
      await q("insert into assistant_messages (session_id, tenant_id, user_id, role, content, locale) values ($1, $2, $3, 'user', 'hello', 'en-IN')", [s!.id, TENANTS.aangan, USERS.aanganOwner]);
      // Visible to staff/otherOwner checks below only if RLS were broken; committed nowhere (rolled back).
      for (const caller of [staff, otherOwner]) {
        await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: caller.userId, role: "authenticated" })]);
        await q("set local role authenticated");
        expect(await q("select id from assistant_sessions where id = $1", [s!.id])).toHaveLength(0);
        expect(await q("select id from assistant_messages where session_id = $1", [s!.id])).toHaveLength(0);
        await rejects(
          q("insert into assistant_messages (session_id, tenant_id, user_id, role, content, locale) values ($1, $2, $3, 'user', 'injected', 'en-IN')", [s!.id, TENANTS.aangan, caller.userId]),
          /row-level security/,
        );
        await q("reset role");
      }
      return s!.id;
    });
    expect(sessionId).toBeTruthy();
  });

  it("messages are append-only (no update / delete for members)", async () => {
    await as(owner, async (q) => {
      const [s] = await q<Row>("insert into assistant_sessions (tenant_id, user_id) values ($1, $2) returning id", [TENANTS.aangan, USERS.aanganOwner]);
      const [m] = await q<Row>("insert into assistant_messages (session_id, tenant_id, user_id, role, content, locale) values ($1, $2, $3, 'assistant', 'hi', 'en-IN') returning id", [s!.id, TENANTS.aangan, USERS.aanganOwner]);
      await rejects(q("update assistant_messages set content = 'edited' where id = $1", [m!.id]), /permission denied/);
      await rejects(q("delete from assistant_messages where id = $1", [m!.id]), /permission denied/);
    });
  });

  it("only allowlisted tools; status moves need theme.edit; args are not editable", async () => {
    await as(owner, async (q) => {
      const [s] = await q<Row>("insert into assistant_sessions (tenant_id, user_id) values ($1, $2) returning id", [TENANTS.aangan, USERS.aanganOwner]);
      await rejects(
        q("insert into assistant_actions (session_id, tenant_id, user_id, tool, args) values ($1, $2, $3, 'run_sql', '{}')", [s!.id, TENANTS.aangan, USERS.aanganOwner]),
        /check constraint/,
      );
      const [a] = await q<Row>(
        `insert into assistant_actions (session_id, tenant_id, user_id, tool, args, before_value) values ($1, $2, $3, 'propose_theme_patch', '{"token":"primary","color":"#7a1f2b"}', '"#1f1a17"') returning id`,
        [s!.id, TENANTS.aangan, USERS.aanganOwner],
      );
      expect(await q("update assistant_actions set status = 'applied', applied_at = now() where id = $1 returning id", [a!.id])).toHaveLength(1);
      await rejects(q(`update assistant_actions set args = '{"token":"primary","color":"#000000"}' where id = $1`, [a!.id]), /permission denied/);
    });
    await as(staff, async (q) => {
      const [s] = await q<Row>("insert into assistant_sessions (tenant_id, user_id) values ($1, $2) returning id", [TENANTS.aangan, USERS.aanganStaff]);
      const [a] = await q<Row>(
        `insert into assistant_actions (session_id, tenant_id, user_id, tool, args) values ($1, $2, $3, 'propose_theme_patch', '{"token":"primary","color":"#7a1f2b"}') returning id`,
        [s!.id, TENANTS.aangan, USERS.aanganStaff],
      );
      // No theme.edit → the status update matches no rows.
      expect(await q("update assistant_actions set status = 'applied' where id = $1 returning id", [a!.id])).toHaveLength(0);
    });
  });

  it("anon sees nothing and the purge function is not callable by members", async () => {
    await as({ role: "anon" }, async (q) => {
      await rejects(q("select id from assistant_sessions"), /permission denied/);
    });
    await as(owner, async (q) => {
      await rejects(q("select app.purge_assistant_history(90)"), /permission denied/);
    });
    await as({ role: "postgres" }, async (q) => {
      await rejects(q("select app.purge_assistant_history(1)"), /at least 7 days/);
      const [r] = await q<{ n: number }>("select app.purge_assistant_history(90) as n");
      expect(r!.n).toBeGreaterThanOrEqual(0);
    });
  });
});
