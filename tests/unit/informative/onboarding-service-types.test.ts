import { describe, expect, it } from "vitest";
import { basicInfoStepSchema, completeDraftSchema, EMPTY_DRAFT, withSeededServices, type CompleteDraft, type InformativeDraft } from "@/features/informative/onboarding/draft";
import { buildCompletionPayload } from "@/features/informative/onboarding/payload";
import { findServiceType, seedFor } from "@/features/informative/service-types";
import { findInformativeTheme } from "@/features/informative/themes/registry";

const base = { businessName: "Smile Care", phone: "9876543210", whatsappSameAsPhone: true, email: "hi@smile.in", city: "Pune", address: "", slug: "smile-care" };
const dentist = { ...base, serviceTypeId: "dentist", serviceType: "Dentist / Dental clinic", category: "clinic_healthcare" };
const theme = findInformativeTheme("nexus-core")!;
const parse = (basic: object, extra: Partial<CompleteDraft> = {}) => completeDraftSchema.parse({ v: 1, basic, themeId: theme.id, services: [], servicesSkipped: true, ...extra });
const seedServices = (id: string): InformativeDraft["services"] => seedFor(findServiceType(id)!, { name: "Smile Care", city: "Pune" }).services;

describe("Step 1 service type (M9)", () => {
  it("a picked type is valid; 'type your own' needs the service text", () => {
    expect(basicInfoStepSchema.safeParse(dentist).success).toBe(true);
    const custom = basicInfoStepSchema.safeParse({ ...base, serviceTypeId: "custom", serviceType: "", category: "other" });
    expect(custom.success).toBe(false);
    expect(custom.error?.issues.map((i) => i.path[0])).toContain("serviceType");
    expect(basicInfoStepSchema.safeParse({ ...base, serviceTypeId: "custom", serviceType: "Yoga retreat", category: "gym_fitness" }).success).toBe(true);
  });

  it("drafts from before M9 (category only) stay valid", () => {
    expect(basicInfoStepSchema.safeParse({ ...base, category: "consultancy" }).success).toBe(true);
  });
});

describe("withSeededServices", () => {
  it("fills empty services from the type, then refills on a type change while untouched", () => {
    const a = withSeededServices({ ...EMPTY_DRAFT }, "dentist", seedServices("dentist"));
    expect(a.seededFrom).toBe("dentist");
    expect(a.services[0]?.name).toBe("Dental check-up");
    const b = withSeededServices(a, "physiotherapist", seedServices("physiotherapist"));
    expect(b.seededFrom).toBe("physiotherapist");
    expect(b.services[0]?.name).toBe("Assessment");
  });

  it("never overwrites services the person wrote", () => {
    const own: InformativeDraft = { ...EMPTY_DRAFT, services: [{ name: "My service", shortDescription: "", priceType: "ON_REQUEST", pricePaise: null }], seededFrom: null };
    expect(withSeededServices(own, "dentist", seedServices("dentist"))).toBe(own);
    expect(withSeededServices({ ...EMPTY_DRAFT }, "custom", null).services).toEqual([]);
  });
});

describe("completion payload with a service type", () => {
  it("adds the type's tagline (when blank), About text, FAQs and service_type", () => {
    const p = buildCompletionPayload(parse(dentist), theme);
    expect(p.site.service_type).toBe("Dentist / Dental clinic");
    expect(p.site.tagline).toBe("Gentle dental care for the whole family");
    expect(p.site.about).toContain("Smile Care is a dental clinic in Pune");
    expect(p.site.faqs.length).toBeGreaterThanOrEqual(3);
    expect(p.site.faqs.every((f) => !/\{(name|city)\}/.test(f.answer))).toBe(true);
  });

  it("keeps the seller's own tagline", () => {
    expect(buildCompletionPayload(parse({ ...dentist, tagline: "Best smiles in Pune" }), theme).site.tagline).toBe("Best smiles in Pune");
  });

  it("skipped services → the type's samples, flagged is_sample, with durations", () => {
    const p = buildCompletionPayload(parse(dentist), theme);
    expect(p.usedSamples).toBe(true);
    expect(p.services.map((s) => s.name)).toEqual(["Dental check-up", "Scaling & polishing", "Tooth-coloured filling"]);
    expect(p.services[0]).toMatchObject({ price_type: "FIXED", price: 300, duration_minutes: 20, is_sample: true });
  });

  it("seeded starter services (up to 6) are the seller's own, not samples", () => {
    const services = seedServices("dentist");
    const p = buildCompletionPayload(parse(dentist, { services, servicesSkipped: false }), theme);
    expect(p.services).toHaveLength(6);
    expect(p.services.every((s) => !s.is_sample)).toBe(true);
    expect(p.services[3]).toMatchObject({ name: "Root canal treatment", price_type: "STARTING_FROM", price: 4500, duration_minutes: 60 });
  });

  it("a custom service keeps its text, with no seeded copy", () => {
    const p = buildCompletionPayload(parse({ ...base, serviceTypeId: "custom", serviceType: "Yoga retreat", category: "gym_fitness" }), theme);
    expect(p.site.service_type).toBe("Yoga retreat");
    expect(p.site.about).toBeNull();
    expect(p.site.faqs).toEqual([]);
  });
});
