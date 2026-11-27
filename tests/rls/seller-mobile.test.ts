import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, anon, as, closePool, one, rejects, service, superuser, user } from "./db";

afterAll(closePool);

type Q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

async function become(q: Q, userId: string) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await q("set local role authenticated");
}
async function becomeService(q: Q) {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
  await q("set local role service_role");
}
async function backToSuper(q: Q) {
  await q("reset role");
}

const admin = user(USERS.platformAdmin);
const PHONE = "+919812345678";

describe("team calls (migration 9100)", () => {
  it("anyone reads active future slots; only staff create them; booking takes a seat", async () => {
    await as(superuser, async (q) => {
      const slot = one(await q<{ id: string }>("insert into team_call_slots (starts_at, capacity) values (now() + interval '2 days', 1) returning id")).id;
      const past = one(await q<{ id: string }>("insert into team_call_slots (starts_at) values (now() - interval '1 day') returning id")).id;

      await q("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      await q("set local role anon");
      const visible = (await q<{ id: string }>("select id from team_call_slots")).map((r) => r.id);
      expect(visible).toContain(slot);
      expect(visible).not.toContain(past);
      await rejects(q("insert into team_call_slots (starts_at) values (now() + interval '3 days')"), /permission denied/);
      await rejects(q("select public.platform_save_team_call_slot(null, now() + interval '3 days', 30, 1, true, null)"), /permission denied|not permitted/);

      // Public booking from the landing page (no account).
      const id = one(await q<{ id: string }>("select public.book_team_call($1, 'Meera', 'meera@example.test', $2, 'Help me launch', 'landing') as id", [slot, PHONE])).id;
      expect(id).toMatch(/[0-9a-f-]{36}/);
      // Anonymous callers can never read bookings.
      await rejects(q("select * from team_call_bookings"), /permission denied/);
      // Slot is now full.
      await rejects(q("select public.book_team_call($1, 'Arun', null, '+919800000001', null, 'landing')", [slot]), /slot full/);
      await rejects(q("select public.book_team_call($1, 'Meera', null, $2, null, 'landing')", [past, PHONE]), /slot not available/);
      // Dashboard bookings need a session.
      await rejects(q("select public.book_team_call($1, 'Meera', null, $2, null, 'dashboard')", [slot, PHONE]), /sign in/);
      await backToSuper(q);
      expect(one(await q<{ booked_count: number }>("select booked_count from team_call_slots where id = $1", [slot])).booked_count).toBe(1);
    });
  });

  it("a merchant books for their own store only, sees and cancels their booking", async () => {
    await as(superuser, async (q) => {
      const slot = one(await q<{ id: string }>("insert into team_call_slots (starts_at, capacity) values (now() + interval '2 days', 2) returning id")).id;
      await become(q, USERS.aanganOwner);
      const mine = one(await q<{ id: string }>("select public.book_team_call($1, 'Asha', null, $2, null, 'dashboard', $3) as id", [slot, PHONE, TENANTS.aangan])).id;
      // A tenant the caller does not belong to is dropped (never trusted).
      const other = one(await q<{ id: string }>("select public.book_team_call($1, 'Asha', null, '+919811111111', null, 'dashboard', $2) as id", [slot, TENANTS.rangrez])).id;
      const rows = await q<{ id: string; tenant_id: string | null; user_id: string }>("select id, tenant_id, user_id from team_call_bookings order by created_at");
      expect(rows.find((r) => r.id === mine)?.tenant_id).toBe(TENANTS.aangan);
      expect(rows.find((r) => r.id === other)?.tenant_id).toBeNull();
      expect(rows.every((r) => r.user_id === USERS.aanganOwner)).toBe(true);
      await q("select public.cancel_my_team_call($1)", [mine]);
      await become(q, USERS.rangrezOwner);
      expect(await q("select id from team_call_bookings")).toHaveLength(0);
      await rejects(q("select public.cancel_my_team_call($1)", [other]), /not permitted/);
      await backToSuper(q);
      expect(one(await q<{ booked_count: number }>("select booked_count from team_call_slots where id = $1", [slot])).booked_count).toBe(1);
    });
  });

  it("super admin adds a day of slots and updates bookings with seat counts kept right", async () => {
    await as(admin, async (q) => {
      const day = one(await q<{ d: string }>("select (current_date + 5)::text as d")).d;
      const added = one(await q<{ n: number }>("select public.platform_add_team_call_slots($1::date, '10:00', '12:00', 30, 30, 1, 'Asia/Kolkata') as n", [day])).n;
      expect(added).toBe(4);
      // Running it again does not duplicate.
      expect(one(await q<{ n: number }>("select public.platform_add_team_call_slots($1::date, '10:00', '12:00', 30, 30, 1, 'Asia/Kolkata') as n", [day])).n).toBe(0);
      const slot = one(await q<{ id: string }>("select id from team_call_slots order by starts_at limit 1")).id;
      const b = one(await q<{ id: string }>("select public.book_team_call($1, 'Admin test', null, $2, null, 'landing') as id", [slot, PHONE])).id;
      await q("select public.platform_update_team_call_booking($1, 'cancelled', 'Customer asked to move')", [b]);
      expect(one(await q<{ booked_count: number }>("select booked_count from team_call_slots where id = $1", [slot])).booked_count).toBe(0);
      await q("select public.platform_update_team_call_booking($1, 'confirmed', null)", [b]);
      expect(one(await q<{ booked_count: number }>("select booked_count from team_call_slots where id = $1", [slot])).booked_count).toBe(1);
      expect(one(await q<{ v: string }>("select public.platform_delete_team_call_slot($1) as v", [slot])).v).toBe("deactivated");
    });
  });
});

describe("verification reward (migration 9200)", () => {
  it("a user can never mark their own phone verified", async () => {
    await as(user(USERS.aanganOwner), async (q) => {
      await q("update profiles set phone = $1, phone_verified_at = now() where id = $2", [PHONE, USERS.aanganOwner]);
      expect(one(await q<{ phone_verified_at: string | null }>("select phone_verified_at from profiles where id = $1", [USERS.aanganOwner])).phone_verified_at).toBeNull();
      await rejects(q("select public.svc_start_phone_verification($1, $2)", [USERS.aanganOwner, PHONE]), /permission denied/);
    });
  });

  it("verifies with the WhatsApp code, then pays 250 credits once", async () => {
    await as(superuser, async (q) => {
      await becomeService(q);
      const code = one(await q<{ code: string }>("select public.svc_start_phone_verification($1, $2) as code", [USERS.aanganOwner, PHONE])).code;
      expect(code).toMatch(/^\d{6}$/);
      await backToSuper(q);
      const before = one(await q<{ balance: number }>("select balance from ai_credit_accounts where tenant_id = $1", [TENANTS.aangan])).balance;

      await become(q, USERS.aanganOwner);
      expect(one(await q<{ s: string }>("select status as s from public.claim_verification_bonus($1)", [TENANTS.aangan])).s).toBe("phone_missing");
      const wrong = code === "000000" ? "111111" : "000000";
      expect(one(await q<{ v: string }>("select public.verify_phone_code($1, $2) as v", [PHONE, wrong])).v).toBe("wrong");
      expect(one(await q<{ v: string }>("select public.verify_phone_code($1, $2) as v", [PHONE, code])).v).toBe("verified");
      const p = one(await q<{ phone: string; phone_verified_at: string | null }>("select phone, phone_verified_at from profiles where id = $1", [USERS.aanganOwner]));
      expect(p.phone).toBe(PHONE);
      expect(p.phone_verified_at).not.toBeNull();

      // Staff (not the owner) cannot claim for the store.
      await become(q, USERS.aanganStaff);
      expect(one(await q<{ s: string }>("select status as s from public.claim_verification_bonus($1)", [TENANTS.aangan])).s).toBe("not_owner");

      await become(q, USERS.aanganOwner);
      const r = one(await q<{ status: string; credits: number; balance: number }>("select * from public.claim_verification_bonus($1)", [TENANTS.aangan]));
      expect(r).toEqual({ status: "claimed", credits: 250, balance: before + 250 });
      expect(one(await q<{ status: string }>("select * from public.claim_verification_bonus($1)", [TENANTS.aangan])).status).toBe("already_claimed");
      expect(await q("select user_id from verification_rewards")).toHaveLength(1);

      // Changing the number clears the verification.
      await q("update profiles set phone = '+919899999999' where id = $1", [USERS.aanganOwner]);
      expect(one(await q<{ phone_verified_at: string | null }>("select phone_verified_at from profiles where id = $1", [USERS.aanganOwner])).phone_verified_at).toBeNull();

      await backToSuper(q);
      const l = await q<{ delta: number }>("select delta from ai_credit_ledger where tenant_id = $1 and kind = 'verification_bonus'", [TENANTS.aangan]);
      expect(l).toEqual([{ delta: 250 }]);
    });
  });

  it("locks a code after 5 wrong tries and refuses anonymous callers", async () => {
    await as(superuser, async (q) => {
      await becomeService(q);
      await q("select public.svc_start_phone_verification($1, $2)", [USERS.rangrezOwner, PHONE]);
      await become(q, USERS.rangrezOwner);
      const results: string[] = [];
      for (let i = 0; i < 6; i++) results.push(one(await q<{ v: string }>("select public.verify_phone_code($1, 'abc') as v", [PHONE])).v);
      expect(results.slice(0, 4)).toEqual(["wrong", "wrong", "wrong", "wrong"]);
      expect(results[4]).toBe("locked");
      expect(results[5]).toBe("locked");
    });
    await as(anon, async (q) => {
      await rejects(q("select public.verify_phone_code($1, '123456')", [PHONE]), /permission denied/);
      await rejects(q("select * from public.claim_verification_bonus($1)", [TENANTS.aangan]), /permission denied/);
    });
    await as(service, async (q) => {
      await rejects(q("select public.svc_start_phone_verification($1, 'not-a-phone')", [USERS.rangrezOwner]), /invalid phone/);
    });
  });
});

describe("admin user directory v2 (migration 9300)", () => {
  it("finds users by phone digits and filters by site type", async () => {
    await as(superuser, async (q) => {
      await q("update profiles set phone = $1 where id = $2", [PHONE, USERS.aanganOwner]);
      await become(q, USERS.platformAdmin);
      const byDigits = await q<{ user_id: string; site_types: string[] }>("select user_id, site_types from public.platform_user_directory_v2('98123 45678')");
      expect(byDigits.map((r) => r.user_id)).toEqual([USERS.aanganOwner]);
      expect(byDigits[0]?.site_types).toEqual(["ONLINE_STORE"]);
      expect((await q("select user_id from public.platform_user_directory_v2('+91-9812345678')")).map((r) => r.user_id)).toEqual([USERS.aanganOwner]);
      const online = (await q<{ user_id: string }>("select user_id from public.platform_user_directory_v2(null, null, null, 'ONLINE_STORE')")).map((r) => r.user_id);
      expect(online).toContain(USERS.aanganOwner);
      expect(online).not.toContain(USERS.shopper);
      expect(await q("select user_id from public.platform_user_directory_v2(null, null, null, 'INFORMATIVE')")).toHaveLength(0);
      await rejects(q("select * from public.platform_user_directory_v2(null, null, null, 'SHOP')"), /unknown site type/);
      await become(q, USERS.aanganOwner);
      await rejects(q("select * from public.platform_user_directory_v2()"), /not permitted/);
    });
  });
});
