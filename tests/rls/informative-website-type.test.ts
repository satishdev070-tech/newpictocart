import { afterAll, describe, expect, it } from "vitest";
import { USERS, as, closePool, one, rejects, superuser, user } from "./db";

afterAll(closePool);

/** Informative Website M1 (docs/informative/PLAN.md): website_type discriminator + create_tenant type param. */
describe("tenants.website_type", () => {
  it("every pre-existing tenant is ONLINE_STORE", async () => {
    const rows = await as(superuser, (q) => q<{ website_type: string }>("select distinct website_type from tenants"));
    expect(rows.map((r) => r.website_type)).toEqual(["ONLINE_STORE"]);
  });

  it("create_tenant with 3 arguments is unchanged: Online Store with a default inventory location", async () => {
    await as(user(USERS.shopper), async (q) => {
      const { create_tenant: id } = one(await q<{ create_tenant: string }>("select public.create_tenant('Neha Label', 'neha-label', 'pictocart.in')"));
      const [t] = await q<{ website_type: string }>("select website_type from tenants where id = $1", [id]);
      expect(t?.website_type).toBe("ONLINE_STORE");
      const locs = await q("select id from inventory_locations where tenant_id = $1 and is_default", [id]);
      expect(locs).toHaveLength(1);
    });
  });

  it("create_tenant(..., 'INFORMATIVE') creates no store-only inventory location", async () => {
    await as(user(USERS.shopper), async (q) => {
      const { create_tenant: id } = one(await q<{ create_tenant: string }>("select public.create_tenant('Calm Clinic', 'calm-clinic', 'pictocart.in', 'INFORMATIVE')"));
      const [t] = await q<{ website_type: string }>("select website_type from tenants where id = $1", [id]);
      expect(t?.website_type).toBe("INFORMATIVE");
      expect(await q("select 1 from inventory_locations where tenant_id = $1", [id])).toHaveLength(0);
      expect(await q("select 1 from stores where tenant_id = $1", [id])).toHaveLength(1);
      const [m] = await q<{ role: string }>("select role from tenant_memberships where tenant_id = $1", [id]);
      expect(m?.role).toBe("owner");
    });
  });

  it("rejects an unknown website type", async () => {
    await rejects(as(user(USERS.shopper), (q) => q("select public.create_tenant('X Store', 'x-store', 'pictocart.in', 'SHOP')")), /invalid website type/);
  });

  it("the type is fixed after creation (even for the database owner)", async () => {
    await rejects(as(superuser, (q) => q("update tenants set website_type = 'INFORMATIVE' where slug = 'aangan'")), /website type cannot be changed/);
    const renamed = await as(superuser, (q) => q("update tenants set name = 'Aangan Two' where slug = 'aangan' returning website_type"));
    expect(renamed).toEqual([{ website_type: "ONLINE_STORE" }]);
  });
});
