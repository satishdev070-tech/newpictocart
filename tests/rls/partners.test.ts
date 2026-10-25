import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { TENANTS, USERS, as, closePool, one, rejects, superuser, user } from "./db";

afterAll(closePool);

const admin = user(USERS.platformAdmin);
type Q = Parameters<Parameters<typeof as>[1]>[0];

/** Runs set-up as postgres, then continues the same transaction as the given authenticated user. */
async function become(q: Q, userId: string) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await q("set local role authenticated");
}

async function newPartner(q: Q, values: { name: string; email: string; type?: string; parent?: string | null; directBps?: number; overrideBps?: number; status?: string }): Promise<string> {
  const row = one(
    await q<{ id: string }>(
      "insert into partners (name, email, partner_type, parent_partner_id, direct_bps, override_bps, status) values ($1, $2, $3, $4, $5, $6, $7) returning id",
      [values.name, values.email, values.type ?? "freelancer", values.parent ?? null, values.directBps ?? 2000, values.overrideBps ?? 0, values.status ?? "active"],
    ),
  );
  return row.id;
}

const lastMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
};

describe("licence batches", () => {
  it("applies the partner's credit first and moves it through the ledger", async () => {
    await as(admin, async (q) => {
      const id = await newPartner(q, { name: "Kiran Agency", email: "kiran@agency.test", type: "agency" });
      expect(Number(one(await q<{ v: string }>("select public.platform_adjust_partner_credit($1, 500, 'onboarding_credit', 'Welcome credit') as v", [id])).v)).toBe(500);
      const batch = one(await q<{ v: string }>("select public.platform_issue_license_batch($1, 'starter', 3, 299) as v", [id])).v;
      const b = one(await q<{ subtotal: string; credit_applied: string; total: string; payment_status: string; batch_number: string }>("select subtotal, credit_applied, total, payment_status, batch_number from partner_license_batches where id = $1", [batch]));
      expect([Number(b.subtotal), Number(b.credit_applied), Number(b.total), b.payment_status]).toEqual([897, 500, 397, "pending"]);
      expect(b.batch_number).toMatch(/^LB-\d{6}-\d{4}$/);
      expect(await q("select license_key from partner_licenses where batch_id = $1 and status = 'available'", [batch])).toHaveLength(3);
      const p = one(await q<{ credit_balance: string }>("select credit_balance from partners where id = $1", [id]));
      expect(Number(p.credit_balance)).toBe(0);
      const ledger = await q<{ kind: string; delta: string }>("select kind, delta from partner_credit_ledger where partner_id = $1 order by created_at, kind", [id]);
      expect(ledger.map((l) => [l.kind, Number(l.delta)]).sort()).toEqual([["batch_applied", -500], ["onboarding_credit", 500]]);

      await q("select public.platform_mark_license_batch_paid($1, 'UTR123')", [batch]);
      await rejects(q("select public.platform_mark_license_batch_paid($1, 'UTR123')", [batch]), /already paid/);
    });
  });

  it("refuses direct credit edits and approves a licence request into a batch", async () => {
    await as(admin, async (q) => {
      const id = await newPartner(q, { name: "Meera Rao", email: "meera@partner.test" });
      await rejects(q("update partners set credit_balance = 100 where id = $1", [id]), /credit functions/);
      const req = one(await q<{ id: string }>("insert into partner_license_requests (partner_id, qty, license_type) values ($1, 2, 'growth') returning id", [id])).id;
      await rejects(q("select public.platform_decide_license_request($1, true)", [req]), /set a unit price/);
      const batch = one(await q<{ v: string }>("select public.platform_decide_license_request($1, true, 499, true, 'REF-1') as v", [req])).v;
      const r = one(await q<{ status: string; batch_id: string }>("select status, batch_id from partner_license_requests where id = $1", [req]));
      expect(r).toEqual({ status: "approved", batch_id: batch });
      expect(one(await q<{ payment_status: string }>("select payment_status from partner_license_batches where id = $1", [batch])).payment_status).toBe("paid");
      await rejects(q("select public.platform_decide_license_request($1, false)", [req]), /already decided/);
    });
  });
});

describe("licence redemption", () => {
  it("moves the store to the licence's plan and attributes it to the partner, once", async () => {
    await as(admin, async (q) => {
      const id = await newPartner(q, { name: "Asha Shah", email: "asha@partner.test" });
      const batch = one(await q<{ v: string }>("select public.platform_issue_license_batch($1, 'growth', 1, 0) as v", [id])).v;
      const key = one(await q<{ license_key: string }>("select license_key from partner_licenses where batch_id = $1", [batch])).license_key;
      const plan = one(await q<{ v: string }>("select public.redeem_partner_license($1, $2) as v", [TENANTS.rangrez, key.toLowerCase()])).v;
      expect(plan).toBe("growth");
      const t = one(await q<{ status: string; code: string; trial_ends_at: string | null }>("select t.status, p.code, t.trial_ends_at from tenants t join plans p on p.id = t.plan_id where t.id = $1", [TENANTS.rangrez]));
      expect(t).toEqual({ status: "active", code: "growth", trial_ends_at: null });
      const ref = one(await q<{ partner_id: string; source: string }>("select partner_id, source from partner_referrals where tenant_id = $1", [TENANTS.rangrez]));
      expect(ref).toEqual({ partner_id: id, source: "license" });
      await rejects(q("select public.redeem_partner_license($1, $2)", [TENANTS.aangan, key]), /not valid or was already used/);
    });
  });

  it("a store's billing manager can redeem; other stores' owners cannot", async () => {
    await as(superuser, async (q) => {
      await become(q, USERS.platformAdmin);
      const id = await newPartner(q, { name: "Asha Shah", email: "asha@partner.test" });
      const batch = one(await q<{ v: string }>("select public.platform_issue_license_batch($1, 'starter', 1, 0) as v", [id])).v;
      const key = one(await q<{ license_key: string }>("select license_key from partner_licenses where batch_id = $1", [batch])).license_key;
      await become(q, USERS.aanganOwner);
      await rejects(q("select public.redeem_partner_license($1, $2)", [TENANTS.rangrez, key]), /not permitted/);
      await become(q, USERS.rangrezOwner);
      expect(one(await q<{ v: string }>("select public.redeem_partner_license($1, $2) as v", [TENANTS.rangrez, key])).v).toBe("starter");
    });
  });
});

describe("commissions and payouts", () => {
  /** Agency (override 5%) → agent (direct 20%) who brought Aangan (growth, ₹2,999/month) last month. */
  async function setup(q: Q) {
    await become(q, USERS.platformAdmin);
    const agency = await newPartner(q, { name: "North Agency", email: "north@agency.test", type: "agency", overrideBps: 500 });
    const agent = await newPartner(q, { name: "Ravi Kumar", email: "ravi@agent.test", type: "agent", parent: agency, directBps: 2000 });
    await q("select public.platform_set_store_partner($1, $2)", [TENANTS.aangan, agent]);
    await q("reset role");
    await q("update partner_referrals set created_at = $1::date - interval '10 days' where tenant_id = $2", [lastMonth(), TENANTS.aangan]);
    await become(q, USERS.platformAdmin);
    return { agency, agent };
  }

  it("accrues direct + override once per month (idempotent)", async () => {
    await as(superuser, async (q) => {
      const { agency, agent } = await setup(q);
      expect(Number(one(await q<{ v: number }>("select public.platform_accrue_partner_commissions($1) as v", [lastMonth()])).v)).toBe(2);
      expect(Number(one(await q<{ v: number }>("select public.platform_accrue_partner_commissions($1) as v", [lastMonth()])).v)).toBe(0);
      const rows = await q<{ partner_id: string; kind: string; amount: string; rate_bps: number }>("select partner_id, kind, amount, rate_bps from partner_commissions order by kind");
      expect(rows.map((r) => [r.partner_id, r.kind, Number(r.amount), r.rate_bps])).toEqual([
        [agent, "direct", 599.8, 2000],
        [agency, "override", 149.95, 500],
      ]);
      const thisMonth = new Date().toISOString().slice(0, 8) + "01";
      await rejects(q("select public.platform_accrue_partner_commissions($1)", [thisMonth]), /not ended/);
    });
  });

  it("batches pending commissions per partner, then settles paid and failed", async () => {
    await as(superuser, async (q) => {
      const { agency, agent } = await setup(q);
      const cutoff = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 0)).toISOString().slice(0, 10);
      const pending = await q<{ partner_id: string; total_amount: string }>("select partner_id, total_amount from public.platform_pending_partner_payouts($1)", [cutoff]);
      expect(pending).toHaveLength(0); // nothing accrued yet; the batch accrues the cutoff month itself
      // Minimum ₹200: the agency's ₹149.95 override rolls over.
      const run = one(await q<{ payouts_created: number; total_amount: string; carried_over: number }>("select * from public.platform_run_partner_payout_batch($1, 'upi', 200)", [cutoff]));
      expect([run.payouts_created, Number(run.total_amount), run.carried_over]).toEqual([1, 599.8, 1]);
      const left = await q<{ partner_id: string; total_amount: string }>("select partner_id, total_amount from public.platform_pending_partner_payouts($1)", [cutoff]);
      expect(left.map((r) => [r.partner_id, Number(r.total_amount)])).toEqual([[agency, 149.95]]);

      const payout = one(await q<{ id: string; amount: string }>("select id, amount from partner_payouts where partner_id = $1", [agent]));
      await rejects(q("select public.platform_settle_partner_payout($1, true, 'x')", [payout.id]), /UTR/);
      await q("select public.platform_settle_partner_payout($1, true, 'UTR998877')", [payout.id]);
      expect(one(await q<{ status: string }>("select status from partner_commissions where partner_id = $1", [agent])).status).toBe("paid");
      await rejects(q("select public.platform_settle_partner_payout($1, false)", [payout.id]), /already settled/);

      // Second batch without a minimum picks up the agency; a failed transfer releases it again.
      const run2 = one(await q<{ payouts_created: number }>("select * from public.platform_run_partner_payout_batch($1, 'bank', 0)", [cutoff]));
      expect(run2.payouts_created).toBe(1);
      const p2 = one(await q<{ id: string }>("select id from partner_payouts where partner_id = $1", [agency])).id;
      await q("select public.platform_settle_partner_payout($1, false, null, 'Bank rejected')", [p2]);
      const c = one(await q<{ status: string; payout_id: string | null }>("select status, payout_id from partner_commissions where partner_id = $1", [agency]));
      expect(c).toEqual({ status: "pending", payout_id: null });
      expect(one(await q<{ status: string }>("select status from partner_payouts where id = $1", [p2])).status).toBe("failed");
    });
  });

  it("leaderboard and org totals aggregate each source separately", async () => {
    await as(superuser, async (q) => {
      const { agency, agent } = await setup(q);
      await q("select public.platform_issue_license_batch($1, 'starter', 2, 100, true)", [agent]);
      await q("select public.platform_issue_license_batch($1, 'starter', 1, 100, true)", [agent]);
      await q("select public.platform_accrue_partner_commissions($1)", [lastMonth()]);
      const today = new Date().toISOString().slice(0, 10);
      const lb = await q<{ partner_id: string; licenses: number; gmv: string; commission: string }>("select partner_id, licenses, gmv, commission from public.platform_partner_leaderboard($1, $2)", [lastMonth(), today]);
      const byId = new Map(lb.map((r) => [r.partner_id, r]));
      expect([byId.get(agent)?.licenses, Number(byId.get(agent)?.gmv), Number(byId.get(agent)?.commission)]).toEqual([3, 300, 599.8]);
      const orgs = await q<{ partner_id: string; team_count: number; licenses_total: number; amount_paid: string }>("select partner_id, team_count, licenses_total, amount_paid from public.platform_partner_orgs('agency')");
      const org = orgs.find((o) => o.partner_id === agency);
      expect([org?.team_count, org?.licenses_total, Number(org?.amount_paid)]).toEqual([1, 3, 300]);
    });
  });
});

describe("one-time codes", () => {
  it("stores only a hash, credits the partner once, and can be revoked", async () => {
    await as(admin, async (q) => {
      const id = await newPartner(q, { name: "Neha Jain", email: "neha@partner.test" });
      const code = one(await q<{ v: string }>("select public.platform_create_partner_code(250, null, 'Launch offer') as v")).v;
      expect(code).toMatch(/^OTC-[0-9A-F]{12}$/);
      const row = one(await q<{ code_hash: string; code_hint: string }>("select code_hash, code_hint from partner_one_time_codes"));
      expect(row.code_hash).toBe(createHash("sha256").update(code).digest("hex"));
      expect(row.code_hint).toBe(code.slice(-4));
      expect(Number(one(await q<{ v: string }>("select public.platform_redeem_partner_code($1, $2) as v", [` ${code.toLowerCase()} `, id])).v)).toBe(250);
      await rejects(q("select public.platform_redeem_partner_code($1, $2)", [code, id]), /not valid, expired or already used/);
      const second = one(await q<{ v: string }>("select public.platform_create_partner_code(10) as v")).v;
      const sid = one(await q<{ id: string }>("select id from partner_one_time_codes where code_hint = $1", [second.slice(-4)])).id;
      await q("select public.platform_revoke_partner_code($1)", [sid]);
      await rejects(q("select public.platform_redeem_partner_code($1, $2)", [second, id]), /not valid/);
    });
  });
});

describe("invites", () => {
  it("attaches the signed-in account with the invited email and activates the partner", async () => {
    const token = "tok-" + "a".repeat(40);
    const hash = createHash("sha256").update(token).digest("hex");
    await as(superuser, async (q) => {
      await become(q, USERS.platformAdmin);
      const id = one(await q<{ id: string }>("insert into partners (name, email, status) values ('Shop Helper', 'shopper@example.test', 'pending') returning id")).id;
      await q("insert into partner_invites (partner_id, email, token_hash, expires_at) values ($1, 'shopper@example.test', $2, now() + interval '7 days')", [id, hash]);
      await become(q, USERS.aanganOwner);
      await rejects(q("select public.accept_partner_invite($1)", [hash]), /email address the invite was sent to/);
      await become(q, USERS.shopper);
      expect(one(await q<{ v: string }>("select public.accept_partner_invite($1) as v", [hash])).v).toBe(id);
      await rejects(q("select public.accept_partner_invite($1)", [hash]), /not valid any more/);
      const p = one(await q<{ user_id: string; status: string }>("select user_id, status from partners where id = $1", [id]));
      expect(p).toEqual({ user_id: USERS.shopper, status: "active" });
    });
  });
});

describe("permissions", () => {
  it("support staff and sellers cannot manage partners or run payouts", async () => {
    await as(superuser, async (q) => {
      await q("insert into platform_memberships (user_id, role) values ($1, 'support')", [USERS.shopper]);
      await become(q, USERS.platformAdmin);
      const id = await newPartner(q, { name: "Vik Patel", email: "vik@partner.test" });
      for (const who of [USERS.shopper, USERS.aanganOwner]) {
        await become(q, who);
        expect(await q("select id from partners")).toHaveLength(0);
        await rejects(q("insert into partners (name, email) values ('Nope Person', 'nope@partner.test')"), /row-level security/);
        await rejects(q("select public.platform_issue_license_batch($1, 'starter', 1, 10)", [id]), /not permitted/);
        await rejects(q("select public.platform_create_partner_code(100)"), /not permitted/);
        await rejects(q("select * from public.platform_run_partner_payout_batch(current_date, 'upi', 0)"), /not permitted/);
        await rejects(q("select * from public.platform_partner_orgs('all')"), /not permitted/);
        await rejects(q("select public.platform_adjust_partner_credit($1, 10, 'adjustment', 'test credit')", [id]), /not permitted/);
      }
    });
  });
});
