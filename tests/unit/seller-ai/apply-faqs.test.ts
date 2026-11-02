import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const auth = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  assertPermission: vi.fn(),
  can: vi.fn(() => false),
}));
const credits = vi.hoisted(() => ({
  debit: vi.fn(async () => ({ ledgerId: "ledger-faq", balance: 20 })),
  refund: vi.fn(async () => {}),
  catalog: vi.fn(async () => ({
    configurable: true,
    packs: [],
    costs: [{ kind: "generate_faq", label: "Apply AI store FAQs", credits: 5 }],
    custom: null,
  })),
  balance: vi.fn(async () => 20),
}));
const inserted = vi.hoisted(() => ({ rows: [] as unknown[], error: null as { message: string; code?: string } | null }));
const existingFaqs = vi.hoisted(() => ({ data: [] as { position: number }[], error: null as { message: string } | null }));
const audit = vi.hoisted(() => vi.fn(async () => {}));
const adminInsert = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: (...a: unknown[]) => refresh(...a) }));
vi.mock("@/lib/tenant/membership", () => ({
  requireTenant: () => auth.requireTenant(),
  assertPermission: (...a: unknown[]) => auth.assertPermission(...a),
  can: (...a: unknown[]) => auth.can(...a),
}));
vi.mock("@/features/ai-credits/server", () => ({
  debitAiCredit: (...a: unknown[]) => credits.debit(...a),
  refundAiCredit: (...a: unknown[]) => credits.refund(...a),
  getAiCreditCatalog: () => credits.catalog(),
  getAiCreditBalance: () => credits.balance(),
}));
vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => audit(...a) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: (row: unknown) => adminInsert(row) }),
  }),
}));
vi.mock("@/lib/supabase/errors", () => ({
  mapDbError: (e: { message?: string }) => new AppError("INTERNAL", { fieldErrors: { _form: [e.message ?? "db"] } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table !== "faqs") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => existingFaqs,
              }),
            }),
          }),
        }),
        insert: (rows: unknown) => {
          if (inserted.error) return { select: async () => ({ data: null, error: inserted.error }) };
          inserted.rows.push(rows);
          const list = Array.isArray(rows) ? rows : [rows];
          return {
            select: async () => ({
              data: list.map((_, i) => ({ id: `faq-${i + 1}` })),
              error: null,
            }),
          };
        },
      };
    },
  }),
}));

import { applyFaqsProposalAction } from "@/features/seller-ai/actions";

const TENANT = {
  tenantId: "t-faq",
  tenantName: "Aangan",
  tenantSlug: "aangan",
  tenantStatus: "active",
  user: { id: "u1", email: "owner@example.com" },
  permissions: new Set(["content.write", "analytics.read"]),
};

const proposal = {
  groupName: "General",
  items: [
    { question: "Do you ship pan-India?", answer: "Yes, we ship across India via trusted couriers." },
    { question: "What is your return policy?", answer: "Unused items can be returned within 7 days." },
    { question: "Is COD available?", answer: "Cash on delivery is available on most pin codes." },
    { question: "How do I track my order?", answer: "You will get a tracking link by SMS and email." },
    { question: "How can I contact you?", answer: "Use the Contact page or reply to your order email." },
  ],
};

describe("applyFaqsProposalAction", () => {
  beforeEach(() => {
    auth.requireTenant.mockReset();
    auth.assertPermission.mockReset();
    auth.assertPermission.mockImplementation((ctx: { permissions: Set<string> }, p: string) => {
      if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN", { context: { permission: p } });
    });
    auth.requireTenant.mockResolvedValue(TENANT);
    credits.debit.mockClear();
    credits.refund.mockClear();
    credits.catalog.mockClear();
    inserted.rows = [];
    inserted.error = null;
    existingFaqs.data = [];
    existingFaqs.error = null;
    audit.mockClear();
    adminInsert.mockClear();
    refresh.mockClear();
  });

  it("requires content.write and debits generate_faq before insert", async () => {
    const r = await applyFaqsProposalAction(proposal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(auth.assertPermission).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t-faq" }), "content.write");
    expect(credits.debit).toHaveBeenCalledWith("t-faq", "generate_faq");
    expect(inserted.rows).toHaveLength(1);
    expect(r.data.inserted).toBe(5);
    expect(r.data.credits).toBe(5);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "faq.ai_applied", tenantId: "t-faq" }));
  });

  it("rejects members without content.write (no debit)", async () => {
    auth.requireTenant.mockResolvedValueOnce({
      ...TENANT,
      permissions: new Set(["analytics.read"]),
    });
    const r = await applyFaqsProposalAction(proposal);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("FORBIDDEN");
    expect(credits.debit).not.toHaveBeenCalled();
    expect(inserted.rows).toHaveLength(0);
  });

  it("refunds credits when the FAQ insert fails", async () => {
    inserted.error = { message: "insert failed", code: "42501" };
    const r = await applyFaqsProposalAction(proposal);
    expect(r.ok).toBe(false);
    expect(credits.debit).toHaveBeenCalledWith("t-faq", "generate_faq");
    expect(credits.refund).toHaveBeenCalledWith({ ledgerId: "ledger-faq", balance: 20 }, expect.stringContaining("insert failed"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("validates empty proposals before debit", async () => {
    const r = await applyFaqsProposalAction({ groupName: "General", items: [] });
    expect(r.ok).toBe(false);
    expect(credits.debit).not.toHaveBeenCalled();
  });
});
