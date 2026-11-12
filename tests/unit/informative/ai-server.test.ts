import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getSite: vi.fn(),
  listServices: vi.fn(),
  listFaqs: vi.fn(),
  updateSiteCopy: vi.fn(),
  updateService: vi.fn(),
  createService: vi.fn(),
  createFaq: vi.fn(),
  softDeleteContent: vi.fn(),
  updateSeo: vi.fn(),
}));
const gen = vi.hoisted(() => ({ runSellerAiGeneration: vi.fn() }));
vi.mock("@/features/informative/server/repo", () => repo);
vi.mock("@/features/seller-ai/server", () => gen);

import { AppError } from "@/lib/errors";
import { applyProposal, applySiteBuild, buildSiteWithAi } from "@/features/informative/ai/server";
import { proposalSchema, siteBuildSchema } from "@/features/informative/ai/schemas";
import type { InformativeContext } from "@/features/informative/server/context";

const ctx = { tenantId: "t1", user: { id: "u1" }, permissions: new Set(["content.write", "settings.write", "store.read"]) } as unknown as InformativeContext;
const svc = (id: string, name: string, extra: object = {}) => ({
  id, name, slug: id, shortDescription: "old", description: null, imagePath: "img.png", priceType: "FIXED", pricePaise: 30000, durationMinutes: 20,
  category: null, isFeatured: true, isActive: true, isSample: false, sortOrder: 0, seo: { title: null, description: null }, ...extra,
});
const site = { businessName: "Smile Care", serviceType: "Dentist", category: "clinic_healthcare", contact: { city: "Pune" }, tagline: null, about: null, seo: { ogImagePath: "og.png" } };

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  gen.runSellerAiGeneration.mockReset();
  repo.getSite.mockResolvedValue(site);
  repo.listFaqs.mockResolvedValue([{ id: "f1", question: "Old?" }]);
});

describe("applySiteBuild", () => {
  it("rewrites copy, improves matching services without touching prices, adds new ones up to 6, swaps FAQs, sets SEO", async () => {
    repo.listServices.mockResolvedValue([svc("s1", "Dental check-up"), svc("s2", "Root canal"), svc("s3", "Whitening"), svc("s4", "Braces"), svc("s5", "Cleaning")]);
    const build = siteBuildSchema.parse({
      tagline: "Gentle dental care",
      about: "We care.",
      services: [
        { name: "dental CHECK-UP", shortDescription: "Better text", description: "Longer", priceType: "FIXED", priceRupees: 999 },
        { name: "Kids dentistry", shortDescription: "New", priceType: "FIXED", priceRupees: 500 },
        { name: "Implants", shortDescription: "Too many", priceType: "ON_REQUEST" },
      ],
      faqs: [{ question: "New?", answer: "Yes." }],
      seoTitle: "Dentist in Pune",
      seoDescription: "Gentle care.",
    });
    await applySiteBuild(ctx, build, { replaceFaqs: true });
    expect(repo.updateSiteCopy).toHaveBeenCalledWith(ctx, { tagline: "Gentle dental care", about: "We care." });
    expect(repo.updateService).toHaveBeenCalledTimes(1);
    const [, id, input] = repo.updateService.mock.calls[0]!;
    expect(id).toBe("s1");
    expect(input).toMatchObject({ name: "Dental check-up", shortDescription: "Better text", description: "Longer", priceType: "FIXED", pricePaise: 30000, imagePath: "img.png", isFeatured: true });
    // 5 existing + 1 new = 6; the third AI service is not added.
    expect(repo.createService).toHaveBeenCalledTimes(1);
    expect(repo.createService.mock.calls[0]![1]).toMatchObject({ name: "Kids dentistry", pricePaise: 50000, isActive: true });
    expect(repo.softDeleteContent).toHaveBeenCalledWith(ctx, "faqs", "f1");
    expect(repo.createFaq).toHaveBeenCalledWith(ctx, { question: "New?", answer: "Yes.", isVisible: true });
    expect(repo.updateSeo).toHaveBeenCalledWith(ctx, expect.objectContaining({ title: "Dentist in Pune", ogImagePath: "og.png" }));
  });

  it("keeps existing FAQs when not replacing", async () => {
    repo.listServices.mockResolvedValue([]);
    await applySiteBuild(ctx, siteBuildSchema.parse({ tagline: "t", about: "a", faqs: [{ question: "Q?", answer: "A." }] }), { replaceFaqs: false });
    expect(repo.softDeleteContent).not.toHaveBeenCalled();
    expect(repo.createFaq).toHaveBeenCalledTimes(1);
  });
});

describe("buildSiteWithAi", () => {
  it("free onboarding build: no debit, and AI being unavailable is not an error", async () => {
    repo.listServices.mockResolvedValue([]);
    gen.runSellerAiGeneration.mockRejectedValue(new AppError("VALIDATION", { context: { reason: "ai_not_configured" } }));
    await expect(buildSiteWithAi(ctx, { free: true })).resolves.toEqual({ built: false, reason: "ai_not_configured" });
    expect(gen.runSellerAiGeneration.mock.calls[0]![0]).toMatchObject({ debit: false, creditKind: "informative_site_build", tenantId: "t1" });
    expect(repo.updateSiteCopy).not.toHaveBeenCalled();
  });

  it("paid rebuild surfaces the error", async () => {
    repo.listServices.mockResolvedValue([]);
    gen.runSellerAiGeneration.mockRejectedValue(new AppError("CONFLICT", { context: { reason: "ai_credits_exhausted" } }));
    await expect(buildSiteWithAi(ctx, { free: false })).rejects.toBeInstanceOf(AppError);
    expect(gen.runSellerAiGeneration.mock.calls[0]![0]).toMatchObject({ debit: true });
  });
});

describe("applyProposal", () => {
  it("adds services and FAQs through the repo", async () => {
    await applyProposal(ctx, proposalSchema.parse({ kind: "services", services: [{ name: "Home visit", priceType: "ON_REQUEST" }] }));
    expect(repo.createService.mock.calls[0]![1]).toMatchObject({ name: "Home visit", priceType: "ON_REQUEST", pricePaise: null });
    await applyProposal(ctx, proposalSchema.parse({ kind: "faqs", faqs: [{ question: "Q?", answer: "A." }, { question: "R?", answer: "B." }] }));
    expect(repo.createFaq).toHaveBeenCalledTimes(2);
    await applyProposal(ctx, proposalSchema.parse({ kind: "site_copy", tagline: "Hi" }));
    expect(repo.updateSiteCopy).toHaveBeenCalledWith(ctx, { tagline: "Hi" });
  });
});
