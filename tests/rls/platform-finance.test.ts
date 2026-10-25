import { afterAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { TENANTS, USERS, anon, as, closePool, one, rejects, superuser, user } from "./db";
import { applyBps } from "../../src/features/platform-finance/calc";

afterAll(closePool);

type Q = <T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

const FINANCE = "00000000-0000-4000-a000-0000000000f1";
const SUPPORT = "00000000-0000-4000-a000-0000000000f2";
const PERIOD = "2025-01-01";

/** Switches the (superuser) transaction to act as `uid` through PostgREST's authenticated role. */
async function become(q: Q, uid: string) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
  await q("set local role authenticated");
}

async function asSuper(q: Q) {
  await q("reset role");
}

let orderNo = 900_000;
async function order(q: Q, o: { tenant: string; total: string; refunded?: string; method: "cod" | "online"; payment: string; fulfillment?: string; placedAt: string }) {
  orderNo += 1;
  await q(
    `insert into orders (tenant_id, order_number, phone, payment_method, payment_status, fulfillment_status, subtotal, grand_total, refunded_total, shipping_address, idempotency_key, placed_at)
     values ($1, $2, '+919800000000', $3, $4, $5, $6, $6, $7, '{}'::jsonb, $8, $9)`,
    [o.tenant, orderNo, o.method, o.payment, o.fulfillment ?? "unfulfilled", o.total, o.refunded ?? "0", `fin-${orderNo}`, o.placedAt],
  );
}

/**
 * Aangan (active, growth plan at 2.5%) in January 2025 IST: ₹700.20 paid online + ₹300.00 delivered COD
 * = ₹1,000.20 commissionable GMV; refunded, unpaid and February orders don't count.
 * 1,000.20 × 2.5% = ₹25.005 → half-up → ₹25.01. Rangrez (starter at 0%) gets no invoice.
 */
async function setup(q: Q) {
  await q("insert into auth.users (id, email) values ($1, 'finance@paliya.test'), ($2, 'support@paliya.test') on conflict do nothing", [FINANCE, SUPPORT]);
  await q("insert into platform_memberships (user_id, role) values ($1, 'finance'), ($2, 'support')", [FINANCE, SUPPORT]);
  await q("update plans set commission_bps = 250 where code = 'growth'");
  await q("update plans set commission_bps = 0 where code = 'starter'");
  const A = TENANTS.aangan;
  await order(q, { tenant: A, total: "700.20", method: "online", payment: "paid", placedAt: "2025-01-10T12:00:00+05:30" });
  await order(q, { tenant: A, total: "300.00", method: "cod", payment: "cod_pending", fulfillment: "delivered", placedAt: "2025-01-31T23:30:00+05:30" });
  await order(q, { tenant: A, total: "500.00", refunded: "500.00", method: "online", payment: "partially_refunded", placedAt: "2025-01-12T10:00:00+05:30" });
  await order(q, { tenant: A, total: "999.00", method: "online", payment: "pending", placedAt: "2025-01-15T10:00:00+05:30" });
  await order(q, { tenant: A, total: "250.00", method: "cod", payment: "cod_pending", fulfillment: "shipped", placedAt: "2025-01-16T10:00:00+05:30" });
  // 1 Feb 00:30 IST is still 31 Jan in UTC: belongs to February.
  await order(q, { tenant: A, total: "400.00", method: "online", payment: "paid", placedAt: "2025-02-01T00:30:00+05:30" });
  await order(q, { tenant: TENANTS.rangrez, total: "800.00", method: "online", payment: "paid", placedAt: "2025-01-20T10:00:00+05:30" });
}

type Invoice = { id: string; tenant_id: string; invoice_number: string; gmv: string; rate_bps: number; commission: string; status: string; due_date: string; period_end: string };
const INVOICE_COLS = "id, tenant_id, invoice_number, gmv::text, rate_bps, commission::text, status, due_date::text, period_end::text";

describe("commission invoice generation (migration 3700)", () => {
  it("bills each store's IST-month GMV at its plan rate, rounding half up like calc.applyBps", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      const run = one(await q<{ created: number; total_commission: string }>("select created, total_commission::text from public.platform_generate_commission_invoices($1)", [PERIOD]));
      expect(run).toEqual({ created: 1, total_commission: "25.01" });
      const inv = one(await q<Invoice>(`select ${INVOICE_COLS} from commission_invoices where period_start = $1`, [PERIOD]));
      expect(inv).toMatchObject({ tenant_id: TENANTS.aangan, invoice_number: "PC-202501-0001", gmv: "1000.20", rate_bps: 250, commission: "25.01", status: "pending", period_end: "2025-02-01", due_date: "2025-02-16" });
      expect(applyBps(100_020, 250)).toBe(2_501); // TS maths agrees with SQL
      await asSuper(q); // audit_logs are not readable by finance staff
      const log = one(await q<{ actor_type: string; metadata: { created: number } }>("select actor_type, metadata from audit_logs where action = 'commission.invoices_generated' and entity_id = $1", [PERIOD]));
      expect(log).toMatchObject({ actor_type: "platform", metadata: { created: 1 } });
    });
  });

  it("is idempotent: a re-run skips invoiced stores and keeps numbering", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      await q("select * from public.platform_generate_commission_invoices($1)", [PERIOD]);
      const again = one(await q<{ created: number; total_commission: string }>("select created, total_commission::text from public.platform_generate_commission_invoices($1)", [PERIOD]));
      expect(again).toEqual({ created: 0, total_commission: "0.00" });

      // A store that becomes billable later gets the next number; the first invoice is untouched.
      await asSuper(q);
      await q("update plans set commission_bps = 100 where code = 'starter'");
      await become(q, FINANCE);
      const third = one(await q<{ created: number; total_commission: string }>("select created, total_commission::text from public.platform_generate_commission_invoices($1)", [PERIOD]));
      expect(third).toEqual({ created: 1, total_commission: "8.00" });
      const rows = await q<Invoice>(`select ${INVOICE_COLS} from commission_invoices where period_start = $1 order by invoice_number`, [PERIOD]);
      expect(rows.map((r) => [r.invoice_number, r.tenant_id, r.commission])).toEqual([
        ["PC-202501-0001", TENANTS.aangan, "25.01"],
        ["PC-202501-0002", TENANTS.rangrez, "8.00"],
      ]);
    });
  });

  it("rejects unfinished or malformed periods", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      await rejects(q("select * from public.platform_generate_commission_invoices(date_trunc('month', now() at time zone 'Asia/Kolkata')::date)"), /has not ended yet/);
      await rejects(q("select * from public.platform_generate_commission_invoices('2025-01-15')"), /first of a month/);
    });
  });
});

describe("finance vs support permissions", () => {
  it("support and sellers cannot generate, read GMV or settle invoices", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, SUPPORT);
      await rejects(q("select * from public.platform_generate_commission_invoices($1)", [PERIOD]), /not permitted/);
      await rejects(q("select * from public.platform_gmv_by_tenant()"), /not permitted/);
      await rejects(q("select * from public.platform_ai_usage()"), /not permitted/);
    });
    await rejects(as(user(USERS.aanganOwner), (q) => q("select * from public.platform_generate_commission_invoices($1)", [PERIOD])), /not permitted/);
    await rejects(as(user(USERS.aanganOwner), (q) => q("select * from public.platform_gmv_by_tenant()")), /not permitted/);
    await rejects(as(anon, (q) => q("select * from public.platform_generate_commission_invoices($1)", [PERIOD])), /permission denied/);
  });

  it("finance reads GMV and AI usage; invoices are visible to finance and the store's billing managers only", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      const gmv = await q<{ tenant_id: string; gmv: string; orders: number }>("select tenant_id, gmv::text, orders from public.platform_gmv_by_tenant($1, $2)", ["2025-01-01T00:00:00+05:30", "2025-02-01T00:00:00+05:30"]);
      const aangan = gmv.find((g) => g.tenant_id === TENANTS.aangan);
      expect(aangan).toMatchObject({ gmv: "1000.20", orders: 2 });
      await q("select * from public.platform_ai_usage()");
      await q("select * from public.platform_generate_commission_invoices($1)", [PERIOD]);
      expect(await q("select id from commission_invoices")).toHaveLength(1);
      await rejects(q("insert into commission_invoices (tenant_id, invoice_number, period_start, period_end, gmv, rate_bps, commission, due_date) values ($1, 'PC-202502-0001', '2025-02-01', '2025-03-01', 1, 1, 1, '2025-03-16')", [TENANTS.aangan]), /permission denied/);

      await asSuper(q);
      await become(q, SUPPORT);
      expect(await q("select id from commission_invoices")).toHaveLength(0);
      await asSuper(q);
      await become(q, USERS.aanganOwner);
      expect(await q("select id from commission_invoices")).toHaveLength(1);
      await asSuper(q);
      await become(q, USERS.rangrezOwner);
      expect(await q("select id from commission_invoices")).toHaveLength(0);
    });
  });
});

describe("invoice status changes", () => {
  it("mark paid records the reference and audits; settled invoices can't change again", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      await q("select * from public.platform_generate_commission_invoices($1)", [PERIOD]);
      const id = one(await q<{ id: string }>("select id from commission_invoices where period_start = $1", [PERIOD])).id;

      await asSuper(q);
      await become(q, SUPPORT);
      await rejects(q("select public.platform_set_commission_invoice_status($1, 'paid')", [id]), /not permitted/);
      await asSuper(q);
      await become(q, FINANCE);

      await rejects(q("select public.platform_set_commission_invoice_status($1, 'refunded')", [id]), /unknown status/);
      await q("select public.platform_set_commission_invoice_status($1, 'paid', null, '  UTR-778899  ')", [id]);
      const paid = one(await q<{ status: string; paid_via: string; payment_reference: string; paid: boolean }>("select status, paid_via, payment_reference, paid_at is not null as paid from commission_invoices where id = $1", [id]));
      expect(paid).toEqual({ status: "paid", paid_via: "manual", payment_reference: "UTR-778899", paid: true });
      await rejects(q("select public.platform_set_commission_invoice_status($1, 'waived', 'Changed our mind')", [id]), /already settled/);
      await asSuper(q);
      const log = one(await q<{ tenant_id: string; entity_id: string }>("select tenant_id, entity_id from audit_logs where action = 'commission.invoice_paid'"));
      expect(log).toEqual({ tenant_id: TENANTS.aangan, entity_id: "PC-202501-0001" });
    });
  });

  it("waiving needs a reason and keeps it", async () => {
    await as(superuser, async (q) => {
      await setup(q);
      await become(q, FINANCE);
      await q("select * from public.platform_generate_commission_invoices($1)", [PERIOD]);
      const id = one(await q<{ id: string }>("select id from commission_invoices where period_start = $1", [PERIOD])).id;
      await rejects(q("select public.platform_set_commission_invoice_status($1, 'waived')", [id]), /reason is required/);
      await rejects(q("select public.platform_set_commission_invoice_status($1, 'waived', ' x ')", [id]), /reason is required/);
      await q("select public.platform_set_commission_invoice_status($1, 'waived', 'Launch month goodwill')", [id]);
      const w = one(await q<{ status: string; waive_reason: string; paid_at: string | null }>("select status, waive_reason, paid_at from commission_invoices where id = $1", [id]));
      expect(w).toEqual({ status: "waived", waive_reason: "Launch month goodwill", paid_at: null });
      await rejects(q("select public.platform_set_commission_invoice_status(gen_random_uuid(), 'paid')"), /not found/);
      await asSuper(q);
      expect(await q("select 1 from audit_logs where action = 'commission.invoice_waived'")).toHaveLength(1);
    });
  });
});
