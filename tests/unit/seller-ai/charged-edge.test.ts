import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const credits = vi.hoisted(() => ({ debit: vi.fn(async () => ({ ledgerId: "led-1", balance: 10 })), refund: vi.fn(async () => {}) }));
const invoke = vi.hoisted(() => ({ fn: vi.fn() }));
const llm = vi.hoisted(() => ({ generateJson: vi.fn() }));
const providers = vi.hoisted(() => ({ load: vi.fn(async () => [{ id: "gemini" as const, apiKey: "k".repeat(20), model: "m" }]) }));
const rate = vi.hoisted(() => ({ limit: vi.fn(async () => {}) }));
const admin = vi.hoisted(() => {
  const single = vi.fn(async () => ({ data: { id: "gen-1" }, error: null }));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })), single, insert };
});

vi.mock("@/features/ai-credits/server", () => ({ debitAiCredit: credits.debit, refundAiCredit: credits.refund }));
vi.mock("@/features/seller-ai/invoke", async () => {
  const actual = await vi.importActual<typeof import("@/features/seller-ai/invoke")>("@/features/seller-ai/invoke");
  return { ...actual, invokeSellerAi: invoke.fn };
});
vi.mock("@/features/neural-pulse/server/generate", () => ({ loadProviders: providers.load, SETUP_MESSAGE: "setup", FAILED_MESSAGE: "failed" }));
vi.mock("@/features/neural-pulse/server/llm", async () => {
  const actual = await vi.importActual<typeof import("@/features/neural-pulse/server/llm")>("@/features/neural-pulse/server/llm");
  return { ...actual, generateJson: llm.generateJson };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rate.limit }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: admin.from }) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AppError } from "@/lib/errors";
import { runChargedSellerAiEdge } from "@/features/seller-ai/server";

const localSchema = z.object({ title: z.string(), blocks: z.array(z.object({ type: z.literal("paragraph"), text: z.string() })).min(1) });
const edgeSchema = localSchema.extend({ provider: z.enum(["gemini", "groq", "anthropic"]), model: z.string(), tokens: z.number().nullable().optional() });

describe("runChargedSellerAiEdge", () => {
  beforeEach(() => {
    credits.debit.mockClear();
    credits.refund.mockClear();
    invoke.fn.mockReset();
    llm.generateJson.mockReset();
    providers.load.mockClear();
    rate.limit.mockClear();
  });

  it("debits, invokes the edge function, and does not refund on success", async () => {
    invoke.fn.mockResolvedValue({ title: "Hello", blocks: [{ type: "paragraph", text: "Body" }], provider: "gemini", model: "m", tokens: 12 });
    const r = await runChargedSellerAiEdge({
      tenantId: "t1",
      userId: "u1",
      kind: "generate_blog",
      featureKey: "generate_blog",
      functionName: "generate-blog",
      edgeBody: { topic: "hello world" },
      edgeSchema,
      pick: (edge) => {
        const { provider, model, tokens, ...data } = edge;
        return { data, provider, model, tokens: tokens ?? null };
      },
      localPrompt: { system: "s", user: "u" },
      localSchema,
    });
    expect(credits.debit).toHaveBeenCalledWith("t1", "generate_blog");
    expect(invoke.fn).toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(r.data.title).toBe("Hello");
    expect(r.provider).toBe("gemini");
  });

  it("refunds when the edge call fails without a local fallback path", async () => {
    invoke.fn.mockRejectedValue(new AppError("INTERNAL", { fieldErrors: { _form: ["boom"] }, context: { reason: "edge_schema" } }));
    await expect(
      runChargedSellerAiEdge({
        tenantId: "t1",
        userId: "u1",
        kind: "draft_contact_reply",
        featureKey: "draft_contact_reply",
        functionName: "generate-contact-reply",
        edgeBody: {},
        edgeSchema,
        pick: (edge) => {
          const { provider, model, tokens, ...data } = edge;
          return { data, provider, model, tokens: tokens ?? null };
        },
        localPrompt: { system: "s", user: "u" },
        localSchema,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(credits.refund).toHaveBeenCalled();
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it("falls back to local generateJson when the edge function is unreachable", async () => {
    invoke.fn.mockRejectedValue(new AppError("INTERNAL", { fieldErrors: { _form: ["net"] }, context: { reason: "edge_network" } }));
    llm.generateJson.mockResolvedValue({ data: { title: "Local", blocks: [{ type: "paragraph", text: "Fallback" }] }, provider: "groq", model: "llama", tokens: 3, attempts: 1 });
    const r = await runChargedSellerAiEdge({
      tenantId: "t1",
      userId: "u1",
      kind: "generate_blog",
      featureKey: "generate_blog",
      functionName: "generate-blog",
      edgeBody: { topic: "fallback" },
      edgeSchema,
      pick: (edge) => {
        const { provider, model, tokens, ...data } = edge;
        return { data, provider, model, tokens: tokens ?? null };
      },
      localPrompt: { system: "s", user: "u" },
      localSchema,
    });
    expect(llm.generateJson).toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(r.provider).toBe("groq");
    expect(r.data.title).toBe("Local");
  });
});
