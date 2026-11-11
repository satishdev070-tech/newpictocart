import { afterAll, describe, expect, it } from "vitest";
import { USERS, anon, as, closePool, one, rejects, user } from "./db";

afterAll(closePool);

/** Informative Website M4: slug check + the single-transaction onboarding completion. */
const site = { theme_id: "zenith-prime", tagline: "Gentle care", category: "clinic_healthcare", contact: { phone: "+919876543210", email: "owner@calm.test", city: "Pune" } };
const pages = [
  { type: "HOME", title: "Home", slug: "home", sections: [{ id: "hero-0", type: "hero", props: {}, order: 0, visible: true }] },
  { type: "ABOUT", title: "About", slug: "about", sections: [] },
  { type: "SERVICES", title: "Services", slug: "services", sections: [] },
  { type: "CONTACT", title: "Contact", slug: "contact", sections: [] },
];
const samples = [
  { name: "General consultation", slug: "general-consultation", short_description: "x", price_type: "FIXED", price: 500, duration_minutes: 15, category: "Consultations", is_sample: true },
  { name: "Child health check", slug: "child-health-check", price_type: "FIXED", price: 600, is_sample: true },
  { name: "Home visit", slug: "home-visit", price_type: "ON_REQUEST", is_sample: true },
];
const call = "select public.complete_informative_onboarding($1, $2, 'pictocart.in', $3::jsonb, $4::jsonb, $5::jsonb) as id";

describe("store_slug_available", () => {
  it("reports taken and free slugs to anyone", async () => {
    await as(anon, async (q) => {
      expect(one(await q<{ ok: boolean }>("select public.store_slug_available('aangan') as ok")).ok).toBe(false);
      expect(one(await q<{ ok: boolean }>("select public.store_slug_available(' AANGAN ') as ok")).ok).toBe(false);
      expect(one(await q<{ ok: boolean }>("select public.store_slug_available('calm-clinic') as ok")).ok).toBe(true);
    });
  });
});

describe("complete_informative_onboarding", () => {
  it("creates the whole site in one go, with no store-only records", async () => {
    await as(user(USERS.shopper), async (q) => {
      const { id } = one(await q<{ id: string }>(call, ["Calm Clinic", "calm-clinic", JSON.stringify(site), JSON.stringify(pages), JSON.stringify(samples)]));
      expect(one(await q<{ website_type: string }>("select website_type from tenants where id = $1", [id])).website_type).toBe("INFORMATIVE");
      expect(one(await q<{ role: string }>("select role from tenant_memberships where tenant_id = $1", [id])).role).toBe("owner");
      expect(one(await q<{ site_mode: string; launch_status: string }>("select site_mode, launch_status from stores where tenant_id = $1", [id]))).toEqual({ site_mode: "informative", launch_status: "draft" });
      expect(one(await q<{ hostname: string }>("select hostname from domains where tenant_id = $1", [id])).hostname).toBe("calm-clinic.pictocart.in");
      const s = one(await q<{ status: string; theme_id: string; category: string }>("select status, theme_id, category from info_sites where tenant_id = $1", [id]));
      expect(s).toEqual({ status: "DRAFT", theme_id: "zenith-prime", category: "clinic_healthcare" });
      expect(one(await q<{ notify_email: string }>("select notify_email from info_site_private where tenant_id = $1", [id])).notify_email).toBe("owner@calm.test");
      const ps = await q<{ type: string; sort_order: number }>("select type, sort_order from info_pages where tenant_id = $1 order by sort_order", [id]);
      expect(ps.map((p) => p.type)).toEqual(["HOME", "ABOUT", "SERVICES", "CONTACT"]);
      const sv = await q<{ name: string; is_sample: boolean; price: string | null }>("select name, is_sample, price from info_services where tenant_id = $1 order by sort_order", [id]);
      expect(sv).toHaveLength(3);
      expect(sv.every((r) => r.is_sample)).toBe(true);
      expect(sv[0]?.price).toBe("500.00");
      for (const t of ["inventory_locations", "shipping_rates", "products", "collections", "categories"]) {
        const exists = await q<{ n: string }>("select count(*)::text as n from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'tenant_id'", [t]);
        if (one(exists).n !== "0") expect(await q(`select 1 from ${t} where tenant_id = $1`, [id]), t).toHaveLength(0);
      }
    });
  });

  it("is idempotent: a second submit returns the same site and writes nothing", async () => {
    await as(user(USERS.shopper), async (q) => {
      const args = ["Calm Clinic", "calm-clinic", JSON.stringify(site), JSON.stringify(pages), JSON.stringify(samples)];
      const a = one(await q<{ id: string }>(call, args)).id;
      const b = one(await q<{ id: string }>(call, args)).id;
      expect(b).toBe(a);
      expect(await q("select 1 from tenants where slug = 'calm-clinic'")).toHaveLength(1);
      expect(await q("select 1 from info_services where tenant_id = $1", [a])).toHaveLength(3);
    });
  });

  it("is all-or-nothing: an invalid service rolls back the tenant", async () => {
    await as(user(USERS.shopper), async (q) => {
      const bad = [{ name: "Priced", slug: "priced", price_type: "FIXED" }];
      await rejects(q(call, ["Calm Clinic", "calm-clinic", JSON.stringify(site), JSON.stringify(pages), JSON.stringify(bad)]), /check constraint/);
      expect(await q("select 1 from tenants where slug = 'calm-clinic'")).toHaveLength(0);
    });
  });

  it("rejects oversized payloads and a slug someone else owns", async () => {
    await as(user(USERS.shopper), async (q) => {
      const many = Array.from({ length: 7 }, (_, i) => ({ name: `S${i}`, slug: `s-${i}` }));
      await rejects(q(call, ["Calm Clinic", "calm-clinic", JSON.stringify(site), JSON.stringify(pages), JSON.stringify(many)]), /payload too large/);
      await rejects(q(call, ["Aangan Clone", "aangan", JSON.stringify(site), JSON.stringify(pages), "[]"]), /duplicate key/);
    });
  });

  it("is not callable anonymously", async () => {
    await rejects(as(anon, (q) => q(call, ["X Clinic", "x-clinic", JSON.stringify(site), "[]", "[]"])), /permission denied/);
  });
});
