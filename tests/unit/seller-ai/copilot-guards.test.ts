import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const PID = "11111111-1111-4111-8111-111111111111";

const auth = vi.hoisted(() => ({
  ctx: { tenantId: "tenant-A", user: { id: "u1" }, permissions: new Set<string>(["analytics.read", "catalog.write"]) },
  requireTenant: vi.fn(),
}));
const db = vi.hoisted(() => ({
  product: { id: "11111111-1111-4111-8111-111111111111", title: "Cotton Kurta", seo: { title: "Old", canonical: "/x" } } as Record<string, unknown> | null,
  updated: [{ id: "x" }] as { id: string }[],
  eqs: [] as [string, unknown][],
  patches: [] as unknown[],
}));
const faqs = vi.hoisted(() => ({ apply: vi.fn() }));
const voice = vi.hoisted(() => ({ transcribe: vi.fn(async () => ({ transcript: "hello" })), speak: vi.fn(async () => null) }));
const audit = vi.hoisted(() => vi.fn(async () => undefined));
const credits = vi.hoisted(() => ({ refund: vi.fn(async () => undefined) }));

vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("@/lib/tenant/membership", () => ({
  requireTenant: () => auth.requireTenant(),
  can: (ctx: { permissions: Set<string> }, p: string) => ctx.permissions.has(p),
  assertPermission: (ctx: { permissions: Set<string> }, p: string) => {
    if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN", { context: { permission: p } });
  },
}));
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/supabase/errors", () => ({ mapDbError: () => new AppError("INTERNAL") }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table !== "products") throw new Error(`unexpected table ${table}`);
      const chain = (result: () => unknown) => {
        const c = {
          eq: (col: string, val: unknown) => {
            db.eqs.push([col, val]);
            return c;
          },
          maybeSingle: async () => result(),
          select: async () => result(),
        };
        return c;
      };
      return {
        select: () => chain(() => ({ data: db.product, error: null })),
        update: (patch: unknown) => {
          db.patches.push(patch);
          return chain(() => ({ data: db.updated, error: null }));
        },
      };
    },
  }),
}));
vi.mock("@/features/seller-ai/actions", () => ({ applyFaqsProposalAction: (i: unknown) => faqs.apply(i) }));
vi.mock("@/features/seller-ai/server", () => ({ runSellerAiGeneration: vi.fn() }));
vi.mock("@/features/ai-credits/server", () => ({
  getAiCreditBalance: async () => 10,
  getAiCreditCatalog: async () => ({ costs: [{ kind: "store_agent", credits: 2 }] }),
  refundAiCredit: credits.refund,
}));
vi.mock("@/features/seller-ai/copilot/voice", async () => {
  const { parseVoiceForm } = await import("@/features/seller-ai/copilot/schemas");
  return {
    parseVoiceUpload: (fd: unknown) => {
      if (!(fd instanceof FormData)) throw new AppError("VALIDATION");
      const r = parseVoiceForm(fd);
      if (!r.ok) throw new AppError("VALIDATION", { fieldErrors: { [r.field]: [r.message] } });
      return r.value;
    },
    transcribeForCopilot: voice.transcribe,
    speakForCopilot: voice.speak,
  };
});
vi.mock("@/features/seller-ai/copilot/server", async () => {
  const real = await vi.importActual<typeof import("@/features/seller-ai/copilot/server")>("@/features/seller-ai/copilot/server");
  return { ...real, loadStoreCopilotContext: vi.fn(), storeCopilotCosts: async () => ({ ask: 2, faqApply: 5 }) };
});

import { runSellerAiGeneration } from "@/features/seller-ai/server";
import { loadStoreCopilotContext } from "@/features/seller-ai/copilot/server";
import {
  askStoreCopilotAction,
  applyStoreCopilotProposalAction,
  speakStoreCopilotAction,
  storeCopilotCostsAction,
  transcribeStoreCopilotAudioAction,
} from "@/features/seller-ai/copilot/actions";

beforeEach(() => {
  auth.ctx.permissions = new Set(["analytics.read", "catalog.write"]);
  auth.requireTenant.mockReset().mockImplementation(async () => auth.ctx);
  db.product = { id: PID, title: "Cotton Kurta", seo: { title: "Old", canonical: "/x" } };
  db.updated = [{ id: PID }];
  db.eqs = [];
  db.patches = [];
  faqs.apply.mockReset();
  voice.transcribe.mockClear();
  audit.mockClear();
});

describe("apply product copy: permission + tenant guards", () => {
  it("rejects invalid payloads before resolving the tenant", async () => {
    const r = await applyStoreCopilotProposalAction({ type: "product_copy", productId: "nope", description: "x" });
    expect(r.ok).toBe(false);
    expect(auth.requireTenant).not.toHaveBeenCalled();
  });

  it("needs catalog.write", async () => {
    auth.ctx.permissions = new Set(["analytics.read"]);
    const r = await applyStoreCopilotProposalAction({ type: "product_copy", productId: PID, description: "New" });
    expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(db.patches).toHaveLength(0);
  });

  it("scopes read and write to the member's tenant, merges SEO, audits", async () => {
    const r = await applyStoreCopilotProposalAction({ type: "product_copy", productId: PID, description: "New", seoTitle: "Kurta" });
    expect(r).toEqual({ ok: true, data: { message: 'Updated "Cotton Kurta".' } });
    expect(db.eqs.filter(([c]) => c === "tenant_id").every(([, v]) => v === "tenant-A")).toBe(true);
    expect(db.eqs.filter(([c]) => c === "tenant_id")).toHaveLength(2);
    expect(db.patches[0]).toEqual({ description: "New", seo: { title: "Kurta", canonical: "/x" } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-A", action: "product.ai_copy_applied", entityId: PID }));
  });

  it("a product id from another store is NOT_FOUND and nothing is written", async () => {
    db.product = null; // RLS + tenant filter hide it
    const r = await applyStoreCopilotProposalAction({ type: "product_copy", productId: PID, description: "New" });
    expect(r).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(db.patches).toHaveLength(0);
  });

  it("ignores any tenant id smuggled into the payload", async () => {
    await applyStoreCopilotProposalAction({ type: "product_copy", productId: PID, description: "New", tenantId: "tenant-B" });
    expect(db.eqs.some(([, v]) => v === "tenant-B")).toBe(false);
  });

  it("FAQ proposals go through the existing confirm-Apply action", async () => {
    faqs.apply.mockResolvedValue({ ok: true, data: { inserted: 2, credits: 5 } });
    const r = await applyStoreCopilotProposalAction({ type: "faq", groupName: "General", items: [{ question: "Q", answer: "A" }, { question: "Q2", answer: "A2" }] });
    expect(faqs.apply).toHaveBeenCalledWith({ groupName: "General", items: expect.any(Array) });
    expect(r).toEqual({ ok: true, data: { message: "Added 2 FAQs to your store." } });
  });
});

describe("costs and voice actions", () => {
  it("costs need analytics.read", async () => {
    expect(await storeCopilotCostsAction()).toEqual({ ok: true, data: { ask: 2, balance: 10 } });
    auth.ctx.permissions = new Set();
    expect(await storeCopilotCostsAction()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("transcribe validates the upload before auth, then checks permission", async () => {
    const bad = new FormData();
    bad.set("language", "en");
    expect(await transcribeStoreCopilotAudioAction(bad)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(auth.requireTenant).not.toHaveBeenCalled();

    const good = new FormData();
    good.set("audio", new Blob([new Uint8Array(4000)], { type: "audio/webm" }));
    good.set("language", "hi");
    expect(await transcribeStoreCopilotAudioAction(good)).toEqual({ ok: true, data: { transcript: "hello" } });
    expect(voice.transcribe).toHaveBeenCalledWith("tenant-A", expect.objectContaining({ language: "hi" }));

    auth.ctx.permissions = new Set();
    expect(await transcribeStoreCopilotAudioAction(good)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("speak rejects unsupported languages", async () => {
    expect(await speakStoreCopilotAction({ text: "hi", language: "fr" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(auth.requireTenant).not.toHaveBeenCalled();
  });
});

describe("ask: questions outside the store", () => {
  it("declines gracefully, offers nothing to run and refunds the credit", async () => {
    vi.mocked(loadStoreCopilotContext).mockResolvedValue({ snapshot: "Store: Nuts", products: [] });
    const charge = { ledgerId: "l1" } as never;
    vi.mocked(runSellerAiGeneration).mockResolvedValue({
      data: {
        topic: "off_topic",
        answer: "I'm Tara, your store assistant, so that's outside what I can help with. Want me to check your stock?",
        links: [{ label: "Products", href: "/dashboard/catalog/products" }],
        proposals: [{ type: "stock", productTitle: "Almonds", mode: "set", quantity: 5 }],
      },
      charge,
    } as never);
    const r = await askStoreCopilotAction({ messages: [{ role: "user", content: "Who won the cricket match yesterday?" }], language: "en" });
    expect(r).toMatchObject({ ok: true, data: { links: [], proposals: [], offTopic: true } });
    expect(credits.refund).toHaveBeenCalledWith(charge, "off_topic question");
  });

  it("keeps store questions charged", async () => {
    credits.refund.mockClear();
    vi.mocked(loadStoreCopilotContext).mockResolvedValue({ snapshot: "Store: Nuts", products: [] });
    vi.mocked(runSellerAiGeneration).mockResolvedValue({ data: { topic: "business", answer: "You have 3 products.", links: [], proposals: [] }, charge: { ledgerId: "l2" } } as never);
    const r = await askStoreCopilotAction({ messages: [{ role: "user", content: "How many products do I have?" }], language: "en" });
    expect(r).toMatchObject({ ok: true, data: { answer: "You have 3 products." } });
    expect(r.ok && r.data.offTopic).toBeFalsy();
    expect(credits.refund).not.toHaveBeenCalled();
  });
});
