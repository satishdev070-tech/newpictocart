import { beforeEach, describe, expect, it, vi } from "vitest";
import { basicInfoStepSchema, canOpenStep, completeDraftSchema, EMPTY_DRAFT, parseDraft, resumeStep, type CompleteDraft } from "@/features/informative/onboarding/draft";
import { buildCompletionPayload } from "@/features/informative/onboarding/payload";
import { findInformativeTheme } from "@/features/informative/themes/registry";

const basic = { businessName: "Calm Clinic", category: "clinic_healthcare", tagline: "", phone: "98765 43210", whatsappSameAsPhone: true, whatsapp: "", email: "owner@calm.test", city: "Pune", address: "", slug: "calm-clinic" };

describe("Step 1 rules", () => {
  it("accepts the plan's required fields and normalises the phone", () => {
    const v = basicInfoStepSchema.parse(basic);
    expect(v.phone).toBe("+919876543210");
  });
  it.each([
    ["businessName", "A"],
    ["businessName", "x".repeat(81)],
    ["tagline", "t".repeat(121)],
    ["phone", "12345"],
    ["email", "nope"],
    ["city", ""],
    ["category", "wellness"],
    ["slug", "ab"],
    ["slug", "admin"],
    ["slug", "Bad Slug"],
    ["slug", "a--b"],
  ])("rejects %s = %j", (k, v) => {
    expect(basicInfoStepSchema.safeParse({ ...basic, [k]: v }).success).toBe(false);
  });
  it("checks a separate WhatsApp number only when not 'same as phone'", () => {
    expect(basicInfoStepSchema.safeParse({ ...basic, whatsappSameAsPhone: false, whatsapp: "123" }).success).toBe(false);
    expect(basicInfoStepSchema.safeParse({ ...basic, whatsappSameAsPhone: true, whatsapp: "123" }).success).toBe(true);
  });
});

describe("draft", () => {
  it("falls back to an empty draft on junk and resumes at the first incomplete step", () => {
    expect(parseDraft({ v: 2 })).toEqual(EMPTY_DRAFT);
    expect(resumeStep(EMPTY_DRAFT)).toBe("basic-info");
    expect(resumeStep({ ...EMPTY_DRAFT, basic })).toBe("theme");
    expect(resumeStep({ ...EMPTY_DRAFT, basic, themeId: "nexus-core" })).toBe("services");
    expect(resumeStep({ ...EMPTY_DRAFT, basic, themeId: "nexus-core", servicesSkipped: true })).toBe("account");
  });
  it("steps can't be skipped, but a complete draft may go from account to finish (regression)", () => {
    const ready = { ...EMPTY_DRAFT, basic, themeId: "nexus-core", servicesSkipped: true };
    expect(canOpenStep("finish", ready)).toBe(true);
    expect(canOpenStep("account", ready)).toBe(true);
    expect(canOpenStep("basic-info", ready)).toBe(true);
    expect(canOpenStep("finish", { ...ready, themeId: null })).toBe(false);
    expect(canOpenStep("services", EMPTY_DRAFT)).toBe(false);
    expect(canOpenStep("basic-info", EMPTY_DRAFT)).toBe(true);
  });
  it("only accepts PNG / JPG / WebP logos (no SVG)", () => {
    const d = { v: 1, basic, themeId: "nexus-core", services: [], servicesSkipped: true };
    expect(completeDraftSchema.safeParse({ ...d, logoDataUrl: "data:image/png;base64,iVBORw0KGgo=" }).success).toBe(true);
    expect(completeDraftSchema.safeParse({ ...d, logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
  });
});

describe("completion payload", () => {
  const theme = findInformativeTheme("zenith-prime")!;
  const parse = (extra: Partial<CompleteDraft> = {}) => completeDraftSchema.parse({ v: 1, basic, themeId: theme.id, services: [], servicesSkipped: true, ...extra });

  it("skipped services → 3 category samples flagged is_sample, money as numeric", () => {
    const p = buildCompletionPayload(parse(), theme);
    expect(p.usedSamples).toBe(true);
    expect(p.services).toHaveLength(3);
    expect(p.services.every((s) => s.is_sample)).toBe(true);
    expect(p.services[0]).toMatchObject({ name: "General consultation", price_type: "FIXED", price: 500 });
  });

  it("starter services keep their order, get unique slugs and are not samples", () => {
    const services = [
      { name: "Yoga", shortDescription: "", priceType: "FIXED" as const, pricePaise: 49950 },
      { name: "Yoga", shortDescription: "Evening", priceType: "ON_REQUEST" as const, pricePaise: null },
    ];
    const p = buildCompletionPayload(parse({ services, servicesSkipped: false }), theme);
    expect(p.services.map((s) => s.slug)).toEqual(["yoga", "yoga-2"]);
    expect(p.services[0]).toMatchObject({ price: 499.5, is_sample: false });
    expect(p.services[1]).toMatchObject({ price: null, short_description: "Evening" });
  });

  it("creates the four system pages with the theme's default sections and the contact block", () => {
    const p = buildCompletionPayload(parse(), theme);
    expect(p.pages.map((x) => x.type)).toEqual(["HOME", "ABOUT", "SERVICES", "CONTACT"]);
    expect(p.pages[0]!.sections.map((s) => s.type)).toEqual(theme.defaultSections);
    expect(p.site).toMatchObject({ theme_id: "zenith-prime", category: "clinic_healthcare", contact: { phone: "+919876543210", whatsapp: "+919876543210", email: "owner@calm.test", city: "Pune" } });
  });
});

// ---- Entry branch + flag gate (mocked) ------------------------------------------------------------

let allowed = false;
vi.mock("@/features/informative/server/onboarding-gate", () => ({ informativeOnboardingAllowed: async () => allowed }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
  unstable_rethrow: (e: unknown) => {
    if (e && typeof e === "object" && ("to" in e || "notFound" in e)) throw e;
  },
}));

describe("onboarding entry (bare /start)", () => {
  beforeEach(() => vi.resetModules());
  it("flag off: exactly today's redirect, query kept", async () => {
    allowed = false;
    const { default: StartPage } = await import("@/app/start/page");
    await expect(StartPage({ searchParams: Promise.resolve({ plan: "pro" }) } as never)).rejects.toMatchObject({ to: "/start/lang?plan=pro" });
    await expect(StartPage({ searchParams: Promise.resolve({}) } as never)).rejects.toMatchObject({ to: "/start/lang" });
  });
  it("flag on: Step 0, query kept for the store branch", async () => {
    allowed = true;
    const { default: StartPage } = await import("@/app/start/page");
    await expect(StartPage({ searchParams: Promise.resolve({ plan: "pro" }) } as never)).rejects.toMatchObject({ to: "/start/build?plan=pro" });
  });
});

describe("completion action is refused when the flag does not allow it", () => {
  it("returns FORBIDDEN without touching the database", async () => {
    allowed = false;
    vi.doMock("@/lib/auth/session", () => ({ requireUserWithRetry: async () => ({ id: "u1", email: "a@b.c", displayName: null }) }));
    const rpc = vi.fn();
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
    const { completeInformativeOnboardingAction } = await import("@/features/informative/onboarding/actions");
    const r = await completeInformativeOnboardingAction({ draft: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(rpc).not.toHaveBeenCalled();
  });
});
