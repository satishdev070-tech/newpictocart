import { describe, expect, it } from "vitest";
import {
  businessInfoSchema,
  enquiryFilterSchema,
  hoursSchema,
  pageSchema,
  reorderSchema,
  serviceSchema,
  starterServicesSchema,
  testimonialSchema,
} from "@/features/informative/schemas";
import { priceToPaise, paiseToDb, toService, toSite } from "@/features/informative/model";
import type { Tables } from "@/lib/supabase/database.types";

const TENANT = "10000000-0000-4000-a000-00000000000a";

describe("business info", () => {
  const base = { businessName: "Calm Clinic", category: "clinic_healthcare", phone: "98765 43210", email: "Hi@Calm.Test", city: "Pune" };
  it("normalises phone and email, requires city", () => {
    const v = businessInfoSchema.parse(base);
    expect(v.phone).toBe("+919876543210");
    expect(v.email).toBe("hi@calm.test");
    expect(businessInfoSchema.safeParse({ ...base, city: "" }).success).toBe(false);
  });
  it("enforces name 2–80 and tagline ≤ 120", () => {
    expect(businessInfoSchema.safeParse({ ...base, businessName: "A" }).success).toBe(false);
    expect(businessInfoSchema.safeParse({ ...base, businessName: "A".repeat(81) }).success).toBe(false);
    expect(businessInfoSchema.safeParse({ ...base, tagline: "t".repeat(121) }).success).toBe(false);
  });
  it("rejects categories outside the list and bad WhatsApp numbers", () => {
    expect(businessInfoSchema.safeParse({ ...base, category: "wellness" }).success).toBe(false);
    expect(businessInfoSchema.safeParse({ ...base, whatsapp: "12345" }).success).toBe(false);
    expect(businessInfoSchema.parse({ ...base, whatsappSameAsPhone: "on" }).whatsappSameAsPhone).toBe(true);
  });
});

describe("services", () => {
  it("needs a price for FIXED / STARTING_FROM and stores paise", () => {
    expect(serviceSchema.safeParse({ name: "Cut", priceType: "FIXED" }).success).toBe(false);
    const v = serviceSchema.parse({ name: "Cut", priceType: "FIXED", pricePaise: "1,299.50" });
    expect(v.pricePaise).toBe(129950);
    expect(serviceSchema.parse({ name: "Cut" }).priceType).toBe("ON_REQUEST");
  });
  it("validates a custom slug", () => {
    expect(serviceSchema.safeParse({ name: "Cut", slug: "Bad Slug" }).success).toBe(false);
    expect(serviceSchema.parse({ name: "Cut", slug: "hair-cut" }).slug).toBe("hair-cut");
  });
  it("starter services: up to 3", () => {
    const s = { name: "A", priceType: "ON_REQUEST" };
    expect(starterServicesSchema.safeParse([s, s, s]).success).toBe(true);
    expect(starterServicesSchema.safeParse([s, s, s, s]).success).toBe(false);
  });
});

describe("pages, testimonials, hours, reorder, filters", () => {
  it("custom pages cannot take reserved addresses", () => {
    expect(pageSchema.safeParse({ title: "About us", slug: "about" }).success).toBe(false);
    expect(pageSchema.safeParse({ title: "Careers", slug: "careers" }).success).toBe(true);
  });
  it("ratings are 1–5", () => {
    expect(testimonialSchema.safeParse({ authorName: "A", text: "Great", rating: "6" }).success).toBe(false);
    expect(testimonialSchema.parse({ authorName: "A", text: "Great" }).rating).toBe(5);
  });
  it("opening hours: one row per day, close after open", () => {
    expect(hoursSchema.safeParse([{ day: 1, open: "09:00", close: "18:00" }]).success).toBe(true);
    expect(hoursSchema.safeParse([{ day: 1, open: "18:00", close: "09:00" }]).success).toBe(false);
    expect(hoursSchema.safeParse([{ day: 1, open: "09:00", close: "18:00" }, { day: 1, open: "10:00", close: "11:00" }]).success).toBe(false);
    expect(hoursSchema.safeParse([{ day: 7, open: "09:00", close: "18:00" }]).success).toBe(false);
  });
  it("reorder ids must be unique uuids", () => {
    const id = "21000000-0000-4000-a000-0000000000a1";
    expect(reorderSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(reorderSchema.safeParse({ ids: [id, id] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: ["x"] }).success).toBe(false);
  });
  it("enquiry filters default to page 1", () => {
    expect(enquiryFilterSchema.parse({})).toEqual({ page: 1 });
    expect(enquiryFilterSchema.safeParse({ status: "SPAM" }).success).toBe(false);
  });
});

describe("row mappers", () => {
  it("converts DB numeric to integer paise and back", () => {
    expect(priceToPaise(1299.5)).toBe(129950);
    expect(priceToPaise("15.00")).toBe(1500);
    expect(priceToPaise(null)).toBeNull();
    expect(paiseToDb(129950)).toBe(1299.5);
    expect(paiseToDb(null)).toBeNull();
  });

  it("maps a service row", () => {
    const row = {
      id: "s1", tenant_id: TENANT, name: "Cut", slug: "cut", short_description: null, description: null, image_path: null,
      price_type: "STARTING_FROM", price: 499, currency: "INR", duration_minutes: 30, category: null, is_featured: true,
      is_active: true, is_sample: true, sort_order: 2, seo: { title: "T" }, created_at: "", updated_at: "", deleted_at: null,
    } as Tables<"info_services">;
    const s = toService(row);
    expect(s.pricePaise).toBe(49900);
    expect(s.priceType).toBe("STARTING_FROM");
    expect(s.isSample).toBe(true);
    expect(s.seo).toEqual({ title: "T", description: null });
  });

  it("maps a site row defensively", () => {
    const row = {
      tenant_id: TENANT, theme_id: "nexus-core", business_name: "Calm", tagline: null, category: "bogus", about: null,
      logo_path: null, favicon_path: null, hero_image_path: null, primary_color: null, secondary_color: null, font_pair: null,
      contact: { phone: "+919876543210", email: "" }, hours: [{ day: 1, open: "09:00", close: "18:00" }, "junk"],
      social_links: { instagram: "https://instagram.com/calm", x: "javascript:alert(1)" }, seo: {}, options: {},
      status: "PUBLISHED", published_at: null, created_at: "", updated_at: "", deleted_at: null,
    } as Tables<"info_sites">;
    const s = toSite(row);
    expect(s.category).toBe("other");
    expect(s.contact.phone).toBe("+919876543210");
    expect(s.contact.email).toBeNull();
    expect(s.hours).toEqual([{ day: 1, open: "09:00", close: "18:00", closed: false }]);
    expect(s.socialLinks).toEqual({ instagram: "https://instagram.com/calm" });
    expect(s.status).toBe("PUBLISHED");
  });
});
