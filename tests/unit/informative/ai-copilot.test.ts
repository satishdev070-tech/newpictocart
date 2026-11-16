import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

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
const ctxState = vi.hoisted(() => ({ permissions: new Set<string>(["content.write", "store.read"]) }));
vi.mock("@/features/informative/server/repo", () => repo);
vi.mock("@/features/seller-ai/server", () => ({ runSellerAiGeneration: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/cache/storefront", () => ({ revalidateStorefront: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/features/informative/server/context", () => ({
  requireInformativeTenant: async () => ({ tenantId: "t1", user: { id: "u1" }, permissions: ctxState.permissions }),
  assertInformativePermission: (ctx: { permissions: Set<string> }, p: string) => {
    if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN");
  },
}));

import { applyProposal, findServiceByName } from "@/features/informative/ai/server";
import { proposalSchema } from "@/features/informative/ai/schemas";
import { applyInformativeCopilotProposalAction } from "@/features/informative/ai/copilot-actions";
import type { InformativeContext } from "@/features/informative/server/context";

const ctx = { tenantId: "t1", user: { id: "u1" }, permissions: new Set(["content.write", "store.read"]) } as unknown as InformativeContext;
const svc = {
  id: "s1", name: "Root canal", slug: "root-canal", shortDescription: "old", description: null, imagePath: "img.png", priceType: "FIXED", pricePaise: 300000, durationMinutes: 60,
  category: null, isFeatured: true, isActive: true, isSample: false, sortOrder: 0, seo: { title: "T", description: null },
};

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  ctxState.permissions = new Set(["content.write", "store.read"]);
  repo.listServices.mockResolvedValue([svc]);
});

describe("service_update proposals", () => {
  it("finds services by name only (case/space-insensitive)", () => {
    expect(findServiceByName([svc], "  ROOT   canal ")?.id).toBe("s1");
    expect(findServiceByName([svc], "Implants")).toBeNull();
  });

  it("updates copy of the matched service, keeping price, photo and flags", async () => {
    const p = proposalSchema.parse({ kind: "service_update", serviceName: "root canal", shortDescription: "Painless", description: "Longer text." });
    await applyProposal(ctx, p);
    const [, id, input] = repo.updateService.mock.calls[0]!;
    expect(id).toBe("s1");
    expect(input).toMatchObject({ name: "Root canal", shortDescription: "Painless", description: "Longer text.", priceType: "FIXED", pricePaise: 300000, imagePath: "img.png", isFeatured: true, seoTitle: "T" });
  });

  it("a service that isn't on this site is NOT_FOUND (no write)", async () => {
    const p = proposalSchema.parse({ kind: "service_update", serviceName: "Implants", description: "x" });
    await expect(applyProposal(ctx, p)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.updateService).not.toHaveBeenCalled();
  });
});

describe("copilot apply action guards", () => {
  it("needs content.write", async () => {
    ctxState.permissions = new Set(["store.read"]);
    const r = await applyInformativeCopilotProposalAction({ proposal: { kind: "seo", title: "Dentist in Pune", description: "Gentle care." } });
    expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(repo.updateSeo).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    const r = await applyInformativeCopilotProposalAction({ proposal: { kind: "delete_everything" } });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("applies an approved proposal to the member's own site", async () => {
    repo.getSite.mockResolvedValue({ seo: { ogImagePath: null } });
    const r = await applyInformativeCopilotProposalAction({ proposal: { kind: "seo", title: "Dentist in Pune", description: "Gentle care." } });
    expect(r).toEqual({ ok: true, data: { message: "Added to your website." } });
    expect(repo.updateSeo.mock.calls[0]![0]).toMatchObject({ tenantId: "t1" });
  });
});
