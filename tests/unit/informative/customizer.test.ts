import { beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_ROLE_PERMISSIONS, type TenantPermission } from "@/lib/permissions/matrix";
import { customizerSchema, homeLayoutSchema, mergeSiteOptions, parseCustomizeOptions } from "@/features/informative/schemas";
import { applyHeroText, applySectionLayout, heroText, moveItem, newSectionId, resetLayout, toLayout } from "@/features/informative/site/customize";
import { contrastAdvice } from "@/features/informative/themes/color";
import { customizerPreview, parseCustomizerDraft } from "@/features/informative/server/customizer-preview";
import { informativeNavFor } from "@/features/informative/panel/nav";
import { buildSiteView } from "@/features/informative/site/view";
import type { PageSection } from "@/features/informative/sections";

const sec = (id: string, type: PageSection["type"], order: number, props: Record<string, unknown> = {}, visible = true): PageSection => ({ id, type, props, order, visible });

// ---- Options schema parse / merge -----------------------------------------------------------------

describe("customizer options", () => {
  it("parses a save: blanks become undefined, bad colours and duplicate section ids are rejected", () => {
    const ok = customizerSchema.parse({ themeId: "aura-one", primaryColor: "#112233", secondaryColor: "", fontPair: "", ctaLabel: " Book now ", heroHeading: "", home: [{ id: "hero-0", type: "hero", visible: true }] });
    expect(ok).toMatchObject({ themeId: "aura-one", primaryColor: "#112233", secondaryColor: undefined, fontPair: undefined, ctaLabel: "Book now", heroHeading: undefined });
    expect(customizerSchema.safeParse({ themeId: "aura-one", primaryColor: "red" }).success).toBe(false);
    expect(customizerSchema.safeParse({ themeId: "aura-one", ctaLabel: "x".repeat(41) }).success).toBe(false);
    expect(homeLayoutSchema.safeParse([{ id: "a", type: "hero", visible: true }, { id: "a", type: "faq", visible: true }]).success).toBe(false);
    expect(homeLayoutSchema.safeParse([{ id: "a", type: "nope", visible: true }]).success).toBe(false);
  });

  it("reads stored options leniently", () => {
    expect(parseCustomizeOptions({ ctaLabel: "Call us", locale: "hi-IN" })).toEqual({ ctaLabel: "Call us" });
    expect(parseCustomizeOptions({ ctaLabel: 42 })).toEqual({ ctaLabel: null });
    expect(parseCustomizeOptions(null)).toEqual({ ctaLabel: null });
    expect(parseCustomizeOptions(["x"])).toEqual({ ctaLabel: null });
  });

  it("merges into options without wiping other keys; null removes a key", () => {
    const prev = { locale: "hi-IN", enquirySuccessMessage: "Thanks", ctaLabel: "Old" };
    expect(mergeSiteOptions(prev, { ctaLabel: "New" })).toEqual({ locale: "hi-IN", enquirySuccessMessage: "Thanks", ctaLabel: "New" });
    expect(mergeSiteOptions(prev, { ctaLabel: null })).toEqual({ locale: "hi-IN", enquirySuccessMessage: "Thanks" });
    expect(mergeSiteOptions(null, { ctaLabel: "A" })).toEqual({ ctaLabel: "A" });
    expect(prev.ctaLabel).toBe("Old");
  });
});

// ---- Section ordering utils ------------------------------------------------------------------------

describe("home section layout", () => {
  const base = [sec("hero-0", "hero", 0, { heading: "Hi", foo: 1 }), sec("services_grid-1", "services_grid", 1), sec("faq-2", "faq", 2, { heading: "Q" })];

  it("applies order + visibility, keeps props, adds new ids and keeps unlisted sections at the end", () => {
    const out = applySectionLayout(base, [
      { id: "faq-2", type: "faq", visible: false },
      { id: "hero-0", type: "hero", visible: true },
      { id: "team-0", type: "team", visible: true },
    ]);
    expect(out.map((s) => [s.id, s.order, s.visible])).toEqual([["faq-2", 0, false], ["hero-0", 1, true], ["team-0", 2, true], ["services_grid-1", 3, true]]);
    expect(out[0]!.props).toEqual({ heading: "Q" });
    expect(out[1]!.props).toEqual({ heading: "Hi", foo: 1 });
    expect(out[2]!.props).toEqual({});
  });

  it("round-trips through toLayout unchanged", () => {
    expect(applySectionLayout(base, toLayout(base))).toEqual(base);
  });

  it("sets / clears hero text on the first hero only", () => {
    const set = applyHeroText(base, { heading: " Welcome ", subheading: "Since 1990" });
    expect(set[0]!.props).toEqual({ heading: "Welcome", subheading: "Since 1990", foo: 1 });
    expect(heroText(set)).toEqual({ heading: "Welcome", subheading: "Since 1990" });
    const cleared = applyHeroText(set, { heading: "", subheading: undefined });
    expect(cleared[0]!.props).toEqual({ foo: 1 });
    expect(applyHeroText([sec("faq-0", "faq", 0)], { heading: "x" })).toEqual([sec("faq-0", "faq", 0)]);
  });

  it("moves, names and resets", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(newSectionId("faq", ["faq-0", "faq-1"])).toBe("faq-2");
    const reset = resetLayout(["hero", "faq", "cta"], [
      { id: "faq-2", type: "faq", visible: false },
      { id: "team-9", type: "team", visible: true },
      { id: "hero-0", type: "hero", visible: false },
    ]);
    expect(reset).toEqual([
      { id: "hero-0", type: "hero", visible: true },
      { id: "faq-2", type: "faq", visible: true },
      { id: "cta-0", type: "cta", visible: true },
      { id: "team-9", type: "team", visible: false },
    ]);
  });
});

// ---- Contrast helper -------------------------------------------------------------------------------

describe("contrastAdvice", () => {
  it("flags mid-tones and pale colours, accepts strong ones", () => {
    const navy = contrastAdvice("#0f2a44");
    expect(navy).toMatchObject({ ok: true, bestText: "light", okAsText: true, rendered: "#0f2a44" });
    const mid = contrastAdvice("#777777");
    expect(mid.ok).toBe(false);
    expect(mid.rendered).not.toBe("#777777");
    const pale = contrastAdvice("#ffe066");
    expect(pale).toMatchObject({ ok: true, bestText: "dark", okAsText: false });
    expect(contrastAdvice("#ffffff", "#000000").okAsText).toBe(true);
  });
});

// ---- Preview overlay + view --------------------------------------------------------------------------

describe("customizer preview overlay", () => {
  const bundle = {
    site: { themeId: "nexus-core", businessName: "Calm", tagline: null, about: null, category: "other", logoPath: null, faviconPath: null, heroImagePath: null, primaryColor: null, secondaryColor: null, fontPair: null, contact: { phone: null, whatsapp: null, email: null, city: null, address: null, mapUrl: null }, hours: [], socialLinks: {}, options: {} },
    services: [],
    pages: [{ type: "HOME", title: "Home", slug: "home", sections: [sec("hero-0", "hero", 0), sec("faq-1", "faq", 1)] }],
    gallery: [],
    team: [],
    testimonials: [],
    faqs: [],
    customize: { ctaLabel: "Saved label" },
  } as never;

  it("ignores missing / malformed drafts", () => {
    expect(parseCustomizerDraft(undefined)).toBeNull();
    expect(parseCustomizerDraft("{bad")).toBeNull();
    expect(parseCustomizerDraft(JSON.stringify({ themeId: "Bad Id" }))).toBeNull();
    const r = customizerPreview(bundle, null);
    expect(r.theme.id).toBe("nexus-core");
    expect(r.sections.map((s) => s.id)).toEqual(["hero-0", "faq-1"]);
  });

  it("lays the unsaved state over the stored site", () => {
    const draft = parseCustomizerDraft(JSON.stringify({ themeId: "aura-one", primaryColor: "#112233", ctaLabel: "Book", heroHeading: "Hello", home: [{ id: "faq-1", type: "faq", visible: true }, { id: "hero-0", type: "hero", visible: false }] }));
    const r = customizerPreview(bundle, draft);
    expect(r.theme.id).toBe("aura-one");
    expect(r.bundle.site.primaryColor).toBe("#112233");
    expect(r.sections.map((s) => [s.id, s.visible])).toEqual([["faq-1", true], ["hero-0", false]]);
    expect(r.sections[1]!.props).toEqual({ heading: "Hello" });
    const view = buildSiteView(r.bundle, { asset: () => null });
    expect(view.ctaLabel).toBe("Book");
    expect(view.overrides.primaryColor).toBe("#112233");
  });
});

// ---- Nav ----------------------------------------------------------------------------------------

describe("customizer nav", () => {
  it("is in the sidebar for theme editors only", () => {
    const hrefs = (p: ReadonlySet<TenantPermission>) => informativeNavFor(p).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs(TENANT_ROLE_PERMISSIONS.owner)).toContain("/informative/customize");
    expect(hrefs(TENANT_ROLE_PERMISSIONS.sales_associate)).not.toContain("/informative/customize");
  });
});

// ---- Action: permission + writes ------------------------------------------------------------------

const TENANT = "20000000-0000-4000-a000-0000000000a1";
const baseCtx = {
  user: { id: "u1", email: "o@x.in", displayName: null },
  tenantId: TENANT,
  tenantName: "Calm",
  tenantSlug: "calm",
  tenantStatus: "active",
  role: "owner",
  permissions: new Set<TenantPermission>(TENANT_ROLE_PERMISSIONS.owner),
  memberships: [],
  websiteType: "INFORMATIVE",
};
let current = baseCtx;
const repo = {
  getSite: vi.fn(async () => ({ themeId: "nexus-core" })),
  listPages: vi.fn(async () => [{ id: "p-home", type: "HOME", sections: [sec("hero-0", "hero", 0, { text: "keep" }), sec("faq-1", "faq", 1)] }]),
  updatePageSections: vi.fn(async () => ({})),
  updateCustomizer: vi.fn(async () => ({})),
};
const audit = vi.fn(async () => undefined);
vi.mock("@/features/informative/server/context", () => ({ requireInformativeTenant: async () => current }));
vi.mock("@/features/informative/server/repo", () => repo);
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("@/lib/cache/storefront", () => ({ revalidateStorefront: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant/active", () => ({ setActiveTenant: vi.fn() }));
vi.mock("@/lib/storage/assets", () => ({ assetUrl: (p: string | null) => (p ? `https://cdn.test/${p}` : null) }));
vi.mock("@/lib/storage/upload", () => ({ uploadTenantImage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: () => undefined }));

beforeEach(() => {
  current = baseCtx;
  for (const fn of [...Object.values(repo), audit]) fn.mockClear();
});

describe("saveCustomizerAction", () => {
  const input = { themeId: "aura-one", primaryColor: "#112233", secondaryColor: "", fontPair: "playfair-lato", ctaLabel: "Book", heroHeading: "Hello", heroSubheading: "", home: [{ id: "faq-1", type: "faq", visible: true }, { id: "hero-0", type: "hero", visible: false }] };

  it("requires theme.edit before touching the repo", async () => {
    const a = await import("@/features/informative/actions");
    current = { ...baseCtx, permissions: new Set<TenantPermission>(["store.read", "content.write"]) };
    const r = await a.saveCustomizerAction(input);
    expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("requires content.write for the home layout", async () => {
    const a = await import("@/features/informative/actions");
    current = { ...baseCtx, permissions: new Set<TenantPermission>(["store.read", "theme.edit"]) };
    expect(await a.saveCustomizerAction(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(repo.updateCustomizer).not.toHaveBeenCalled();
    const r = await a.saveCustomizerAction({ ...input, home: undefined, heroHeading: undefined });
    expect(r.ok).toBe(true);
    expect(repo.updatePageSections).not.toHaveBeenCalled();
    expect(repo.updateCustomizer).toHaveBeenCalled();
  });

  it("rejects unknown designs and font pairs", async () => {
    const a = await import("@/features/informative/actions");
    expect((await a.saveCustomizerAction({ ...input, themeId: "no-such-theme" })).ok).toBe(false);
    expect((await a.saveCustomizerAction({ ...input, fontPair: "comic-sans" })).ok).toBe(false);
    expect(repo.updateCustomizer).not.toHaveBeenCalled();
  });

  it("owner: merges layout + hero text into the stored home sections and saves columns + options", async () => {
    const a = await import("@/features/informative/actions");
    const r = await a.saveCustomizerAction(input);
    expect(r.ok).toBe(true);
    expect(repo.updatePageSections).toHaveBeenCalledWith(baseCtx, "p-home", [
      sec("faq-1", "faq", 0),
      sec("hero-0", "hero", 1, { text: "keep", heading: "Hello" }, false),
    ]);
    expect(repo.updateCustomizer).toHaveBeenCalledWith(baseCtx, expect.objectContaining({ themeId: "aura-one", primaryColor: "#112233", secondaryColor: undefined, fontPair: "playfair-lato" }), { ctaLabel: "Book" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "informative.theme_changed" }));
  });
});
