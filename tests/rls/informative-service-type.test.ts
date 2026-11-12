import { afterAll, describe, expect, it } from "vitest";
import { USERS, as, closePool, one, rejects, user } from "./db";

afterAll(closePool);

/** Informative M9 (migration 8500): service_type, About text and FAQs at onboarding. */
const pages = [{ type: "HOME", title: "Home", slug: "home", sections: [] }];
const services = [{ name: "Dental check-up", slug: "dental-check-up", price_type: "FIXED", price: 300, duration_minutes: 20 }];
const call = "select public.complete_informative_onboarding($1, $2, 'pictocart.in', $3::jsonb, $4::jsonb, $5::jsonb) as id";
const contact = { phone: "+919876543210", email: "hi@smile.test", city: "Pune" };

describe("complete_informative_onboarding with a service type", () => {
  it("stores service_type, about and the FAQs in order", async () => {
    await as(user(USERS.shopper), async (q) => {
      const site = {
        theme_id: "nexus-core", tagline: "Gentle dental care", category: "clinic_healthcare", service_type: "Dentist / Dental clinic",
        about: "Smile Care is a dental clinic in Pune.", contact,
        faqs: [{ question: "How do I book?", answer: "Send an enquiry." }, { question: "Do you treat children?", answer: "Yes." }],
      };
      const { id } = one(await q<{ id: string }>(call, ["Smile Care", "smile-care", JSON.stringify(site), JSON.stringify(pages), JSON.stringify(services)]));
      expect(one(await q<{ service_type: string; about: string }>("select service_type, about from info_sites where tenant_id = $1", [id]))).toEqual({
        service_type: "Dentist / Dental clinic",
        about: "Smile Care is a dental clinic in Pune.",
      });
      const faqs = await q<{ question: string; sort_order: number; is_visible: boolean }>("select question, sort_order, is_visible from info_faqs where tenant_id = $1 order by sort_order", [id]);
      expect(faqs).toEqual([
        { question: "How do I book?", sort_order: 0, is_visible: true },
        { question: "Do you treat children?", sort_order: 1, is_visible: true },
      ]);
      expect(one(await q<{ duration_minutes: number }>("select duration_minutes from info_services where tenant_id = $1", [id])).duration_minutes).toBe(20);
    });
  });

  it("older payloads (no service_type / about / faqs) still work and leave them empty", async () => {
    await as(user(USERS.shopper), async (q) => {
      const site = { theme_id: "nexus-core", category: "other", contact };
      const { id } = one(await q<{ id: string }>(call, ["Old Style", "old-style", JSON.stringify(site), JSON.stringify(pages), "[]"]));
      expect(one(await q<{ service_type: string | null; about: string | null }>("select service_type, about from info_sites where tenant_id = $1", [id]))).toEqual({ service_type: null, about: null });
      expect(await q("select 1 from info_faqs where tenant_id = $1", [id])).toHaveLength(0);
    });
  });

  it("rejects malformed or oversized FAQs", async () => {
    await as(user(USERS.shopper), async (q) => {
      const bad = (site: object, slug: string) => q(call, ["Bad", slug, JSON.stringify({ theme_id: "nexus-core", category: "other", contact, ...site }), JSON.stringify(pages), "[]"]);
      await rejects(bad({ faqs: { question: "x" } }, "bad-one"), /invalid payload/);
      await rejects(bad({ faqs: Array.from({ length: 11 }, () => ({ question: "q", answer: "a" })) }, "bad-two"), /payload too large/);
      await rejects(bad({ faqs: [{ question: "", answer: "a" }] }, "bad-three"), /check constraint|violates/);
    });
  });
});
