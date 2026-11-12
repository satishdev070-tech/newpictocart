import { afterAll, describe, expect, it } from "vitest";
import { USERS, as, closePool, one, rejects, superuser } from "./db";

afterAll(closePool);

/** Informative Website M7: the public enquiry write paths. */
const A = "20000000-0000-4000-a000-0000000000a1"; // PUBLISHED
const B = "20000000-0000-4000-a000-0000000000b1"; // DRAFT
const SVC_A = "21000000-0000-4000-a000-0000000000a1";
const SVC_B = "21000000-0000-4000-a000-0000000000b1";
type Q = Parameters<Parameters<typeof as>[1]>[0];

async function fixtures(q: Q) {
  await q("insert into tenants (id, name, slug, status, website_type) values ($1, 'Calm Clinic', 'calm-clinic', 'active', 'INFORMATIVE'), ($2, 'Peak Gym', 'peak-gym', 'active', 'INFORMATIVE')", [A, B]);
  await q("insert into stores (tenant_id, name) values ($1, 'Calm Clinic'), ($2, 'Peak Gym')", [A, B]);
  await q("insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')", [A, USERS.aanganOwner]);
  await q("insert into info_sites (tenant_id, business_name, status) values ($1, 'Calm Clinic', 'PUBLISHED'), ($2, 'Peak Gym', 'DRAFT')", [A, B]);
  await q("insert into info_site_private (tenant_id, notify_email) values ($1, 'owner@calm.test')", [A]);
  await q("insert into info_services (id, tenant_id, name, slug) values ($1, $3, 'Consultation', 'consultation'), ($2, $4, 'Training', 'training')", [SVC_A, SVC_B, A, B]);
}
async function anonymous(q: Q) {
  await q("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
  await q("set local role anon");
}
const submit = "select * from public.submit_info_enquiry($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)";

describe("submit_info_enquiry", () => {
  it("anon can submit to a published site; returns the notification target", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await anonymous(q);
      const r = one(await q<{ enquiry_id: string; notify_email: string; notify_email_enabled: boolean; business_name: string }>(submit, [A, "Asha", "+919876543210", "asha@x.in", "Hello", SVC_A, "2026-12-01", "10:30", "SERVICE_PAGE", true]));
      expect(r).toMatchObject({ notify_email: "owner@calm.test", notify_email_enabled: true, business_name: "Calm Clinic" });
      await q("reset role");
      const e = one(await q<{ source: string; status: string; consent_at: string | null; service_id: string }>("select source, status, consent_at, service_id from info_enquiries where id = $1", [r.enquiry_id]));
      expect(e).toMatchObject({ source: "SERVICE_PAGE", status: "NEW", service_id: SVC_A });
      expect(e.consent_at).not.toBeNull();
    });
  });

  it("refuses drafts, missing consent, other sites' services and bad input", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await anonymous(q);
      await rejects(q(submit, [B, "Asha", "+919876543210", null, null, null, null, null, "CONTACT_FORM", true]), /site unavailable/);
      await rejects(q(submit, [A, "Asha", "+919876543210", null, null, null, null, null, "CONTACT_FORM", false]), /consent required/);
      await rejects(q(submit, [A, "Asha", "+919876543210", null, null, SVC_B, null, null, "CONTACT_FORM", true]), /invalid service/);
      await rejects(q(submit, [A, "Asha", "+919876543210", null, null, null, null, null, "WHATSAPP_CLICK", true]), /invalid source/);
      await rejects(q(submit, [A, "", "+919876543210", null, null, null, null, null, "CONTACT_FORM", true]), /check constraint/);
    });
  });

  it("caps a flood per site", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await q("insert into info_enquiries (tenant_id, name, phone) select $1, 'Spam', '+910000000000' from generate_series(1, 50)", [A]);
      await anonymous(q);
      await rejects(q(submit, [A, "Asha", "+919876543210", null, null, null, null, null, "CONTACT_FORM", true]), /too many enquiries/);
    });
  });

  it("visitors still cannot insert or read enquiries directly", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await anonymous(q);
      await rejects(q("insert into info_enquiries (tenant_id, name, phone) values ($1, 'X', '+919876543210')", [A]), /permission denied/);
      await rejects(q("select * from info_enquiries"), /permission denied/);
    });
  });
});

describe("record_info_whatsapp_click", () => {
  it("logs a lead with no visitor data, only for published sites, capped", async () => {
    await as(superuser, async (q) => {
      await fixtures(q);
      await anonymous(q);
      await q("select public.record_info_whatsapp_click($1, $2)", [A, SVC_A]);
      await q("select public.record_info_whatsapp_click($1, null)", [B]);
      await q("reset role");
      const rows = await q<{ tenant_id: string; source: string; email: string | null; message: string }>("select tenant_id, source, email, message from info_enquiries where source = 'WHATSAPP_CLICK'");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ tenant_id: A, email: null });
      expect(rows[0]!.message).toContain("Consultation");
      await q("insert into info_enquiries (tenant_id, name, phone, source) select $1, 'WhatsApp chat', 'via WhatsApp', 'WHATSAPP_CLICK' from generate_series(1, 30)", [A]);
      await anonymous(q);
      await q("select public.record_info_whatsapp_click($1, null)", [A]);
      await q("reset role");
      expect(one(await q<{ n: string }>("select count(*)::text as n from info_enquiries where source = 'WHATSAPP_CLICK'")).n).toBe("31");
    });
  });
});
