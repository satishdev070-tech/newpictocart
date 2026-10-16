import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, as, closePool, one, superuser, user } from "./db";

afterAll(closePool);

const A = TENANTS.aangan;
type Q = Parameters<Parameters<typeof as>[1]>[0];

/** Who got a notification of this type (optionally for one dedupe key prefix). */
async function recipients(q: Q, type: string, keyPrefix = ""): Promise<string[]> {
  const rows = await q<{ user_id: string }>("select user_id from notifications where type = $1 and coalesce(dedupe_key, '') like $2 order by user_id", [type, `${keyPrefix}%`]);
  return rows.map((r) => r.user_id);
}

/** Acts as `uid` for auth.uid() while staying superuser (producers run as the writer). */
async function actor(q: Q, uid: string | null) {
  await q("select set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : ""]);
}

async function insertOrder(q: Q, method: "cod" | "online", n: number): Promise<string> {
  return one(
    await q<{ id: string }>(
      `insert into orders (tenant_id, order_number, phone, payment_method, payment_status, subtotal, grand_total, shipping_address, idempotency_key)
       values ($1, $2, '+919800000000', $3, $4, 1499, 1499, '{}'::jsonb, $5) returning id`,
      [A, n, method, method === "cod" ? "cod_pending" : "pending", `test-${n}`],
    ),
  ).id;
}

describe("in-app notifications (migration 3000)", () => {
  it("RLS: users read and mark only their own rows; no inserts; only read_at is writable", async () => {
    let ownerRow = "";
    await as(superuser, async (q) => {
      ownerRow = one(await q<{ id: string }>("select id from notifications where user_id = $1 and type = 'review.new' limit 1", [USERS.aanganOwner])).id;
    });
    await as(user(USERS.aanganOwner), async (q) => {
      const mine = await q<{ user_id: string }>("select user_id from notifications");
      expect(mine.length).toBeGreaterThan(0);
      expect(new Set(mine.map((r) => r.user_id))).toEqual(new Set([USERS.aanganOwner]));
      expect(await q("update notifications set read_at = now() where id = $1 returning id", [ownerRow])).toHaveLength(1);
      await expect(q("update notifications set title = 'x' where id = $1", [ownerRow])).rejects.toThrow(/permission denied/);
      await expect(q("insert into notifications (user_id, scope, tenant_id, type, title) values ($1, 'tenant', $2, 'order.new', 'x')", [USERS.aanganOwner, A])).rejects.toThrow(/permission denied/);
      await expect(q("delete from notifications where id = $1", [ownerRow])).rejects.toThrow(/permission denied/);
    });
    await as(user(USERS.rangrezOwner), async (q) => {
      expect(await q("select id from notifications where id = $1", [ownerRow])).toEqual([]);
      expect(await q("update notifications set read_at = now() where id = $1 returning id", [ownerRow])).toEqual([]);
    });
    await as(user(USERS.shopper), async (q) => {
      expect(await q("select id from notifications")).toEqual([]);
    });
    // A member who leaves the store stops seeing its notifications.
    await as(superuser, async (q) => {
      await q("update tenant_memberships set status = 'disabled' where tenant_id = $1 and user_id = $2", [A, USERS.aanganStaff]);
      await q("set local role authenticated");
      await actor(q, USERS.aanganStaff);
      expect(await q("select id from notifications where tenant_id = $1", [A])).toEqual([]);
    });
  });

  it("orders: COD/online new order, payment received/failed, cancelled, returned; actor skipped; deduped", async () => {
    await as(superuser, async (q) => {
      await actor(q, null);
      const cod = await insertOrder(q, "cod", 9001);
      expect(await recipients(q, "order.new", `order:${cod}`)).toEqual([USERS.aanganOwner, USERS.aanganStaff].sort());
      const n = one(await q<{ title: string; body: string; link: string }>("select title, body, link from notifications where dedupe_key = $1 limit 1", [`order:${cod}:new`]));
      expect(n).toEqual({ title: "New order #9001", body: "₹1499 · Cash on delivery", link: `/dashboard/orders/${cod}` });

      // Online: nothing until paid; then "new order" (not "payment received").
      const online = await insertOrder(q, "online", 9002);
      expect(await recipients(q, "order.new", `order:${online}`)).toEqual([]);
      await q("update orders set payment_status = 'paid' where id = $1", [online]);
      expect(await recipients(q, "order.new", `order:${online}`)).toHaveLength(2);
      expect(await recipients(q, "payment.received", `order:${online}`)).toEqual([]);

      // COD collected on delivery → payment received. The staff member who did it isn't notified.
      await actor(q, USERS.aanganStaff);
      await q("update orders set payment_status = 'paid' where id = $1", [cod]);
      expect(await recipients(q, "payment.received", `order:${cod}`)).toEqual([USERS.aanganOwner]);

      const failed = await insertOrder(q, "online", 9003);
      await actor(q, null);
      await q("update orders set payment_status = 'failed' where id = $1", [failed]);
      expect(await recipients(q, "payment.failed", `order:${failed}`)).toHaveLength(2);
      await q("update orders set status = 'cancelled', cancel_reason = 'Customer asked' where id = $1", [failed]);
      expect(one(await q<{ body: string }>("select body from notifications where dedupe_key = $1 limit 1", [`order:${failed}:cancelled`])).body).toBe("Customer asked");
      await q("update orders set fulfillment_status = 'rto' where id = $1", [cod]);
      expect(await recipients(q, "order.returned", `order:${cod}`)).toHaveLength(2);

      // Same transition again → no duplicate rows.
      await q("update orders set status = 'confirmed' where id = $1", [failed]);
      await q("update orders set status = 'cancelled' where id = $1", [failed]);
      expect(await recipients(q, "order.cancelled", `order:${failed}`)).toHaveLength(2);
    });
  });

  it("recipients follow permissions and per-user mutes (stock, reviews, AI, domains, plan)", async () => {
    await as(superuser, async (q) => {
      await actor(q, null);
      const lvl = one(await q<{ variant_id: string; location_id: string }>("select variant_id, location_id from inventory_levels where tenant_id = $1 limit 1", [A]));
      await q("update product_variants set track_inventory = true, low_stock_threshold = 5 where id = $1", [lvl.variant_id]);
      await q("update inventory_levels set available = 20 where variant_id = $1 and location_id = $2", [lvl.variant_id, lvl.location_id]);
      // Staff mutes low stock; owner still gets it.
      await q("insert into notification_preferences (user_id, muted_types) values ($1, '{stock.low}')", [USERS.aanganStaff]);
      await q("update inventory_levels set available = 3 where variant_id = $1 and location_id = $2", [lvl.variant_id, lvl.location_id]);
      expect(await recipients(q, "stock.low", `stock:${lvl.variant_id}`)).toEqual([USERS.aanganOwner]);
      await q("update inventory_levels set available = 0 where variant_id = $1 and location_id = $2", [lvl.variant_id, lvl.location_id]);
      expect(await recipients(q, "stock.out", `stock:${lvl.variant_id}`)).toEqual([USERS.aanganOwner, USERS.aanganStaff].sort());

      // marketing.write (owner, not staff) for AI credits: 80% of 30 → low, 30 → used up.
      for (let i = 0; i < 30; i++) await q("insert into ai_generations (tenant_id, kind, provider) values ($1, 'caption', 'test')", [A]);
      expect(await recipients(q, "ai.credits_low")).toEqual([USERS.aanganOwner]);
      expect(await recipients(q, "ai.credits_exhausted")).toEqual([USERS.aanganOwner]);

      // domains.manage (owner) for custom domains only.
      const d = one(await q<{ id: string }>("insert into domains (tenant_id, hostname, type) values ($1, 'shop.aangan-test.in', 'custom') returning id", [A])).id;
      await q("update domains set status = 'verified', ssl_status = 'active' where id = $1", [d]);
      expect(await recipients(q, "domain.status")).toEqual([USERS.aanganOwner]);
      expect(await recipients(q, "domain.ssl")).toEqual([USERS.aanganOwner]);
    });
  });

  it("platform: plan requests, store published, sign-ups; decision goes back to the owner", async () => {
    await as(superuser, async (q) => {
      await actor(q, USERS.aanganOwner);
      const plan = one(await q<{ id: string }>("select id from plans where code = 'growth'")).id;
      const req = one(await q<{ request_plan: string }>("select request_plan($1, $2, 'monthly', 'please')", [A, plan])).request_plan;
      expect(await recipients(q, "platform.plan_request")).toEqual([USERS.platformAdmin]);
      expect(one(await q<{ scope: string; tenant_id: string | null; link: string }>("select scope, tenant_id, link from notifications where type = 'platform.plan_request'"))).toEqual({ scope: "platform", tenant_id: null, link: "/admin/plan-requests" });

      await actor(q, USERS.platformAdmin);
      await q("select platform_decide_plan_request($1, true, '', null)", [req]);
      expect(await recipients(q, "plan.request_decided")).toEqual([USERS.aanganOwner]);

      await actor(q, USERS.aanganOwner);
      await q("update stores set launch_status = 'draft' where tenant_id = $1", [A]);
      await q("update stores set launch_status = 'live' where tenant_id = $1", [A]);
      expect(await recipients(q, "platform.store_published")).toEqual([USERS.platformAdmin]);

      await q("insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000ff', 'new-seller@example.com')");
      expect(await recipients(q, "platform.signup")).toEqual([USERS.platformAdmin]);

      // Platform rows are invisible to sellers and visible to the admin.
      await q("set local role authenticated");
      expect(await q("select id from notifications where scope = 'platform'")).toEqual([]);
      await actor(q, USERS.platformAdmin);
      expect((await q("select id from notifications where scope = 'platform'")).length).toBeGreaterThanOrEqual(3);
    });
  });

  it("abandoned cart recovered only when a reminder went out", async () => {
    await as(superuser, async (q) => {
      await actor(q, null);
      const plain = one(await q<{ id: string }>("insert into carts (tenant_id) values ($1) returning id", [A])).id;
      await q("update carts set status = 'converted' where id = $1", [plain]);
      expect(await recipients(q, "cart.recovered")).toEqual([]);
      const reminded = one(await q<{ id: string }>("insert into carts (tenant_id) values ($1) returning id", [A])).id;
      await q("insert into email_log (tenant_id, kind, recipient_hash, idempotency_key, status) values ($1, 'abandoned_cart', 'h', $2, 'sent')", [A, `${A}:cart:${reminded}:abandoned:email`]);
      await q("update carts set status = 'converted' where id = $1", [reminded]);
      expect(await recipients(q, "cart.recovered")).toEqual([USERS.aanganOwner, USERS.aanganStaff].sort());
    });
  });

  it("reminders: trial ending is sent once; only the service role can run it", async () => {
    await as(superuser, async (q) => {
      await q("update tenants set status = 'trial', trial_ends_at = now() + interval '2 days' where id = $1", [A]);
      await q("select notifications_run_reminders()");
      await q("select notifications_run_reminders()");
      expect(await recipients(q, "plan.trial_expiring")).toEqual([USERS.aanganOwner]);
      expect(one(await q<{ title: string }>("select title from notifications where type = 'plan.trial_expiring'")).title).toBe("Your free trial ends in 2 days");
    });
    await as(user(USERS.aanganOwner), async (q) => {
      await expect(q("select notifications_run_reminders()")).rejects.toThrow(/permission denied/);
      await expect(q("select notify_platform_event('platform.tenants.read', 'platform.dispute', 'x', '', '/admin', '{}', 'k')")).rejects.toThrow(/permission denied/);
      await expect(q("select app.notify_tenant($1, 'orders.read', 'order.new', 'x', '', null, '{}', 'k')", [A])).rejects.toThrow(/permission denied/);
    });
  });
});
