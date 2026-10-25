import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, as, closePool, one, rejects, superuser, user } from "./db";

afterAll(closePool);

const admin = user(USERS.platformAdmin);
const aOwner = user(USERS.aanganOwner);
type Q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Inside a superuser transaction: switch to a signed-in user (keeps the superuser's earlier writes). */
async function become(q: Q, userId: string) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await q("set local role authenticated");
}

const balance = async (q: Q, tenant: string) => one(await q<{ balance: number }>("select balance from ai_credit_accounts where tenant_id = $1", [tenant])).balance;

describe("per-action credit costs", () => {
  it("debits the configured cost per kind and refunds the full cost", async () => {
    await as(superuser, async (q) => {
      await q("update ai_credit_action_costs set credits = 3 where kind = 'caption'");
      await q("update ai_credit_accounts set balance = 10 where tenant_id = $1", [TENANTS.aangan]);
      await become(q, USERS.aanganOwner);
      const d = one(await q<{ ledger_id: string; balance: number }>("select * from public.ai_credit_debit($1, 'caption')", [TENANTS.aangan]));
      expect(d.balance).toBe(7);
      const row = one(await q<{ delta: number; metadata: { credits: number } }>("select delta, metadata from ai_credit_ledger where id = $1", [d.ledger_id]));
      expect(row.delta).toBe(-3);
      expect(row.metadata.credits).toBe(3);

      // Unknown kinds cost one credit.
      expect(one(await q<{ balance: number }>("select * from public.ai_credit_debit($1, 'brand_new_kind')", [TENANTS.aangan])).balance).toBe(6);

      const after = one(await q<{ v: number }>("select public.ai_credit_refund($1, 'provider failed') as v", [d.ledger_id])).v;
      expect(after).toBe(9);
      // Idempotent.
      expect(one(await q<{ v: number }>("select public.ai_credit_refund($1) as v", [d.ledger_id])).v).toBe(9);
      expect(await balance(q, TENANTS.aangan)).toBe(9);
    });
  });

  it("refuses when the balance is below the action cost", async () => {
    await as(superuser, async (q) => {
      await q("update ai_credit_action_costs set credits = 5 where kind = 'plan'");
      await q("update ai_credit_accounts set balance = 4 where tenant_id = $1", [TENANTS.aangan]);
      await become(q, USERS.aanganOwner);
      await rejects(q("select * from public.ai_credit_debit($1, 'plan')", [TENANTS.aangan]), /AI credits exhausted/);
      expect(await balance(q, TENANTS.aangan)).toBe(4);
    });
  });
});

describe("welcome credits", () => {
  it("new stores get welcome_credits from ai_credit_settings", async () => {
    await as(admin, async (q) => {
      await q("update ai_credit_settings set welcome_credits = 42 where id = 1");
      const id = one(await q<{ id: string }>("select public.platform_create_tenant($1, 'Kesar Looms', 'kesar', 'localhost') as id", [USERS.shopper])).id;
      expect(await balance(q, id)).toBe(42);
      const l = one(await q<{ delta: number; kind: string }>("select delta, kind from ai_credit_ledger where tenant_id = $1", [id]));
      expect(l).toEqual({ delta: 42, kind: "signup_bonus" });
    });
  });

  it("zero welcome credits creates an empty account without a ledger row", async () => {
    await as(admin, async (q) => {
      await q("update ai_credit_settings set welcome_credits = 0 where id = 1");
      const id = one(await q<{ id: string }>("select public.platform_create_tenant($1, 'Neel Kala', 'neelkala', 'localhost') as id", [USERS.shopper])).id;
      expect(await balance(q, id)).toBe(0);
      expect(await q("select 1 from ai_credit_ledger where tenant_id = $1", [id])).toHaveLength(0);
    });
  });
});

describe("credit purchases", () => {
  it("pack prices come from ai_credit_packs, with a promo bonus and a use counted", async () => {
    await as(superuser, async (q) => {
      await q("update ai_credit_packs set credits = 600, price = 449 where code = 'growth'");
      await q("insert into ai_credit_promos (code, bonus_pct, max_uses) values ('DIWALI25', 25, 1)");
      await become(q, USERS.aanganOwner);
      const id = one(await q<{ id: string }>("select public.request_ai_credit_purchase($1, 'growth', 'offline', ' diwali25 ') as id", [TENANTS.aangan])).id;
      const r = one(await q<{ pack: string; credits: number; amount: string; promo_code: string; bonus_credits: number }>("select pack, credits, amount, promo_code, bonus_credits from ai_credit_purchase_requests where id = $1", [id]));
      expect(r).toEqual({ pack: "growth", credits: 750, amount: "449.00", promo_code: "DIWALI25", bonus_credits: 150 });
      await q("reset role");
      expect(one(await q<{ uses: number }>("select uses from ai_credit_promos where code = 'DIWALI25'")).uses).toBe(1);
    });
  });

  it("custom amounts use custom_credits_per_rupee within min/max", async () => {
    await as(aOwner, async (q) => {
      await rejects(q("select public.request_ai_credit_purchase($1, 'custom', 'online', null, 50)", [TENANTS.aangan]), /between/);
      await rejects(q("select public.request_ai_credit_purchase($1, 'custom', 'online', null, 60000)", [TENANTS.aangan]), /between/);
      await rejects(q("select public.request_ai_credit_purchase($1, 'custom', 'online')", [TENANTS.aangan]), /between/);
      const id = one(await q<{ id: string }>("select public.request_ai_credit_purchase($1, 'custom', 'online', null, 200.5) as id", [TENANTS.aangan])).id;
      const r = one(await q<{ credits: number; amount: string; bonus_credits: number }>("select credits, amount, bonus_credits from ai_credit_purchase_requests where id = $1", [id]));
      expect(r).toEqual({ credits: 2205, amount: "200.50", bonus_credits: 0 });
      // One pending request per store.
      await rejects(q("select public.request_ai_credit_purchase($1, 'starter', 'online')", [TENANTS.aangan]), /already pending/);
    });
  });

  it("rejects invalid, disabled, expired, used-up promos and unknown or inactive packs", async () => {
    await as(superuser, async (q) => {
      await q("insert into ai_credit_promos (code, bonus_pct, active) values ('OFFNOW', 10, false)");
      await q("insert into ai_credit_promos (code, bonus_pct, ends_at) values ('OLD10', 10, date '2020-01-01')");
      await q("insert into ai_credit_promos (code, bonus_pct, max_uses, uses) values ('GONE', 10, 2, 2)");
      await q("update ai_credit_packs set active = false where code = 'pro'");
      await become(q, USERS.aanganOwner);
      for (const code of ["NOPE", "OFFNOW", "OLD10", "GONE"]) {
        await rejects(q("select public.request_ai_credit_purchase($1, 'starter', 'online', $2)", [TENANTS.aangan, code]), /promo code is not valid/);
      }
      await rejects(q("select public.request_ai_credit_purchase($1, 'pro', 'online')", [TENANTS.aangan]), /unknown pack/);
      await rejects(q("select public.request_ai_credit_purchase($1, 'mega', 'online')", [TENANTS.aangan]), /unknown pack/);
      expect(await q("select 1 from ai_credit_purchase_requests where tenant_id = $1 and status = 'pending'", [TENANTS.aangan])).toHaveLength(0);
    });
  });

  it("approval adds pack + bonus credits", async () => {
    await as(superuser, async (q) => {
      await q("insert into ai_credit_promos (code, bonus_pct) values ('BONUS50', 50)");
      await q("update ai_credit_accounts set balance = 0 where tenant_id = $1", [TENANTS.aangan]);
      await become(q, USERS.aanganOwner);
      const id = one(await q<{ id: string }>("select public.request_ai_credit_purchase($1, 'starter', 'online', 'BONUS50') as id", [TENANTS.aangan])).id;
      await become(q, USERS.platformAdmin);
      await q("select public.decide_ai_credit_purchase($1, true, null, 'UTR123')", [id]);
      await q("reset role");
      expect(await balance(q, TENANTS.aangan)).toBe(150);
    });
  });
});

describe("economy tables are platform-written", () => {
  it("platform staff can update settings, packs, routes and prices", async () => {
    await as(admin, async (q) => {
      expect(await q("update ai_credit_settings set margin_multiplier = 4 where id = 1 returning id")).toHaveLength(1);
      await q("insert into ai_credit_packs (code, label, credits, price) values ('festive', 'Festive', 800, 649)");
      await q("insert into ai_feature_routes (feature_key, primary_provider, primary_model, fallback_provider) values ('caption', 'anthropic', 'claude-opus-5-5', 'groq')");
      await q("insert into ai_model_prices (provider, model, price_per_million) values ('gemini', 'gemini-3.8-flash', 12.5)");
      await q("insert into ai_credit_promos (code, bonus_pct) values ('STAFF10', 10)");
      expect(one(await q<{ v: { accounts: number; byKind: unknown[] } }>("select public.platform_ai_credit_insights() as v")).v.accounts).toBeGreaterThan(0);
      await rejects(q("insert into ai_feature_routes (feature_key, primary_provider, fallback_provider) values ('ideas', 'gemini', 'gemini')"), /check constraint/);
    });
  });

  it("sellers cannot write settings, packs, costs, promos, routes or prices, nor read promos or insights", async () => {
    await as(aOwner, async (q) => {
      expect(await q("update ai_credit_settings set welcome_credits = 9999 where id = 1 returning id")).toHaveLength(0);
      expect(await q("update ai_credit_action_costs set credits = 1000 returning kind")).toHaveLength(0);
      await rejects(q("insert into ai_credit_packs (code, label, credits, price) values ('free', 'Free', 99999, 1)"), /row-level security/);
      await rejects(q("insert into ai_credit_promos (code, bonus_pct) values ('HACK', 500)"), /row-level security/);
      await rejects(q("insert into ai_feature_routes (feature_key, primary_provider) values ('caption', 'groq')"), /row-level security/);
      await rejects(q("insert into ai_model_prices (provider, model, price_per_million) values ('groq', 'x1', 0)"), /row-level security/);
      await rejects(q("select public.platform_ai_credit_insights()"), /not permitted/);
      expect(await q("select * from ai_credit_promos")).toHaveLength(0);
      expect(await q("select * from ai_model_prices")).toHaveLength(0);
      // Readable for the Billing panel and runGeneration routing.
      expect((await q("select code from ai_credit_packs")).length).toBeGreaterThan(0);
      expect((await q("select kind from ai_credit_action_costs")).length).toBeGreaterThan(0);
      expect(await q("select feature_key from ai_feature_routes")).toBeDefined();
      expect(one(await q<{ welcome_credits: number }>("select welcome_credits from ai_credit_settings")).welcome_credits).toBe(100);
    });
    await as(superuser, async (q) => {
      expect(one(await q<{ welcome_credits: number }>("select welcome_credits from ai_credit_settings")).welcome_credits).toBe(100);
    });
  });

  it("staff (non-owner) without billing.manage cannot request purchases", async () => {
    await rejects(as(user(USERS.aanganStaff), (q) => q("select public.request_ai_credit_purchase($1, 'starter', 'online')", [TENANTS.aangan])), /not permitted/);
  });
});
