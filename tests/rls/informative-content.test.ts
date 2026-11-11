import { afterAll, describe, expect, it } from "vitest";
import { TENANTS, USERS, as, closePool, rejects, superuser } from "./db";

afterAll(closePool);

/**
 * Informative Website M2 (docs/informative/PLAN.md): tenant isolation, public visibility (published
 * only), enquiry privacy, soft-delete-only, and "informative rows only for INFORMATIVE tenants".
 * Fixtures are created as the DB owner inside the rolled-back test transaction; `become` then
 * switches to the caller exactly as PostgREST does (role + JWT claims).
 */
const A = "20000000-0000-4000-a000-0000000000a1"; // informative, PUBLISHED, owner = aanganOwner
const B = "20000000-0000-4000-a000-0000000000b1"; // informative, DRAFT,     owner = rangrezOwner
const SVC_A = "21000000-0000-4000-a000-0000000000a1";
const SVC_A_INACTIVE = "21000000-0000-4000-a000-0000000000a2";
const SVC_A_DELETED = "21000000-0000-4000-a000-0000000000a3";
const SVC_B = "21000000-0000-4000-a000-0000000000b1";
const ENQ_A = "22000000-0000-4000-a000-0000000000a1";

type Q = Parameters<Parameters<typeof as>[1]>[0];

async function become(q: Q, who: "anon" | "postgres" | string) {
  await q("reset role");
  if (who === "postgres") return;
  const claims = who === "anon" ? { role: "anon" } : { sub: who, role: "authenticated" };
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await q(`set local role ${who === "anon" ? "anon" : "authenticated"}`);
}

async function fixtures(q: Q) {
  await q(
    `insert into tenants (id, name, slug, status, website_type) values
       ($1, 'Calm Clinic', 'calm-clinic', 'active', 'INFORMATIVE'),
       ($2, 'Peak Gym', 'peak-gym', 'active', 'INFORMATIVE')`,
    [A, B],
  );
  await q("insert into stores (tenant_id, name) values ($1, 'Calm Clinic'), ($2, 'Peak Gym')", [A, B]);
  await q("insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner'), ($3, $4, 'owner')", [A, USERS.aanganOwner, B, USERS.rangrezOwner]);
  await q(
    `insert into info_sites (tenant_id, business_name, category, status, published_at) values
       ($1, 'Calm Clinic', 'clinic_healthcare', 'PUBLISHED', now()),
       ($2, 'Peak Gym', 'gym_fitness', 'DRAFT', null)`,
    [A, B],
  );
  await q("insert into info_site_private (tenant_id, notify_email) values ($1, 'owner@calm.test')", [A]);
  await q(
    `insert into info_services (id, tenant_id, name, slug, price_type, price, is_active, deleted_at) values
       ($1, $5, 'Consultation', 'consultation', 'FIXED', 500, true, null),
       ($2, $5, 'Old offer', 'old-offer', 'ON_REQUEST', null, false, null),
       ($3, $5, 'Removed', 'removed', 'ON_REQUEST', null, true, now()),
       ($4, $6, 'Personal training', 'personal-training', 'STARTING_FROM', 1500, true, null)`,
    [SVC_A, SVC_A_INACTIVE, SVC_A_DELETED, SVC_B, A, B],
  );
  await q(
    `insert into info_pages (tenant_id, type, title, slug, is_published) values
       ($1, 'HOME', 'Home', 'home', true), ($1, 'CUSTOM', 'Secret', 'secret', false), ($2, 'HOME', 'Home', 'home', true)`,
    [A, B],
  );
  await q("insert into info_faqs (tenant_id, question, answer) values ($1, 'Q?', 'A.'), ($2, 'Q?', 'A.')", [A, B]);
  await q("insert into info_enquiries (id, tenant_id, name, phone, message, service_id) values ($1, $2, 'Asha', '+919876543210', 'Hello', $3)", [ENQ_A, A, SVC_A]);
}

describe("informative content: tenant isolation", () => {
  it("each owner reads only their own site's rows", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.aanganOwner);
      const own = await q<{ id: string }>("select id from info_services where tenant_id = $1 order by name", [A]);
      expect(own.map((r) => r.id).sort()).toEqual([SVC_A, SVC_A_INACTIVE, SVC_A_DELETED].sort());
      expect(await q("select id from info_services where tenant_id = $1", [B])).toHaveLength(0); // B is a draft: not public either
      expect(await q("select 1 from info_pages where tenant_id = $1", [B])).toHaveLength(0);
    });
  });

  it("an owner cannot write another tenant's content", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.rangrezOwner);
      expect(await q("update info_services set name = 'pwned' where id = $1 returning id", [SVC_A])).toHaveLength(0);
      await rejects(q("insert into info_faqs (tenant_id, question, answer) values ($1, 'x', 'y')", [A]), /row-level security/);
      expect(await q("update info_sites set business_name = 'pwned' where tenant_id = $1 returning tenant_id", [A])).toHaveLength(0);
    });
  });

  it("clients never hard-delete: removal is a soft delete", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.aanganOwner);
      await rejects(q("delete from info_services where id = $1", [SVC_A]), /permission denied/);
      expect(await q("update info_services set deleted_at = now() where id = $1 returning id", [SVC_A])).toHaveLength(1);
    });
  });

  it("informative rows can only exist for INFORMATIVE tenants", async () => {
    await as(superuser, async (q) => {
      await rejects(q("insert into info_sites (tenant_id, business_name) values ($1, 'Aangan')", [TENANTS.aangan]), /not an informative website/);
      await become(q, USERS.aanganOwner);
      await rejects(q("insert into info_sites (tenant_id, business_name) values ($1, 'Aangan')", [TENANTS.aangan]), /not an informative website/);
    });
  });

  it("an enquiry can only reference a service of the same site", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await rejects(q("insert into info_enquiries (tenant_id, name, phone, service_id) values ($1, 'X', '+919876543210', $2)", [A, SVC_B]), /foreign key/);
    });
  });

  it("service slugs are unique per site among live rows, and reusable after a soft delete", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.aanganOwner);
      await rejects(q("insert into info_services (tenant_id, name, slug) values ($1, 'Dup', 'consultation')", [A]), /duplicate key/);
      expect(await q("insert into info_services (tenant_id, name, slug) values ($1, 'Again', 'removed') returning id", [A])).toHaveLength(1);
      // Another site may use the same slug.
      await become(q, USERS.rangrezOwner);
      expect(await q("insert into info_services (tenant_id, name, slug) values ($1, 'Consult', 'consultation') returning id", [B])).toHaveLength(1);
    });
  });

  it("priced services need an amount", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await rejects(q("insert into info_services (tenant_id, name, slug, price_type) values ($1, 'X', 'x', 'FIXED')", [A]), /check constraint/);
    });
  });
});

describe("informative content: public visibility", () => {
  it("anon sees only published, active, non-deleted content of PUBLISHED sites", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, "anon");
      const sites = await q<{ tenant_id: string }>("select tenant_id from info_sites where tenant_id in ($1, $2)", [A, B]);
      expect(sites.map((s) => s.tenant_id)).toEqual([A]);
      const services = await q<{ id: string }>("select id from info_services where tenant_id in ($1, $2)", [A, B]);
      expect(services.map((s) => s.id)).toEqual([SVC_A]);
      const pages = await q<{ slug: string }>("select slug from info_pages where tenant_id in ($1, $2)", [A, B]);
      expect(pages.map((p) => p.slug)).toEqual(["home"]);
      expect(await q("select 1 from info_faqs where tenant_id = $1", [B])).toHaveLength(0);
    });
  });

  it("a suspended tenant's site disappears from public reads", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await q("update tenants set status = 'suspended' where id = $1", [A]);
      await become(q, "anon");
      expect(await q("select 1 from info_sites where tenant_id = $1", [A])).toHaveLength(0);
      expect(await q("select 1 from info_services where tenant_id = $1", [A])).toHaveLength(0);
    });
  });

  it("owner-only settings and enquiries are never public", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, "anon");
      await rejects(q("select * from info_site_private"), /permission denied/);
      await rejects(q("select * from info_enquiries"), /permission denied/);
      await rejects(q("insert into info_enquiries (tenant_id, name, phone) values ($1, 'X', '+919876543210')", [A]), /permission denied/);
      await become(q, USERS.rangrezOwner);
      expect(await q("select 1 from info_site_private where tenant_id = $1", [A])).toHaveLength(0);
      expect(await q("select 1 from info_enquiries where tenant_id = $1", [A])).toHaveLength(0);
    });
  });
});

describe("informative enquiries: staff access", () => {
  it("members update status and notes only; nobody inserts directly", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.aanganOwner);
      expect(await q("select id from info_enquiries where tenant_id = $1", [A])).toHaveLength(1);
      expect(await q("update info_enquiries set status = 'CONTACTED', notes = 'Called back' where id = $1 returning id", [ENQ_A])).toHaveLength(1);
      await rejects(q("update info_enquiries set name = 'Changed' where id = $1", [ENQ_A]), /permission denied/);
      await rejects(q("insert into info_enquiries (tenant_id, name, phone) values ($1, 'X', '+919876543210')", [A]), /permission denied/);
    });
  });

  it("another tenant's member cannot change a lead", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await become(q, USERS.rangrezOwner);
      expect(await q("update info_enquiries set status = 'CLOSED' where id = $1 returning id", [ENQ_A])).toHaveLength(0);
    });
  });
});
