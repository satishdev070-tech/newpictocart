import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const loadProviders = vi.hoisted(() => vi.fn(async () => [{ id: "gemini" as const, apiKey: "k".repeat(20), model: "gemini-2.0-flash" }]));
const generateJson = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { title: "Silk Saree", description: "Handwoven.", shortDescription: "Festive", tags: ["saree"], priceMinor: 249900 },
    provider: "gemini" as const,
    model: "gemini-2.0-flash",
    tokens: 42,
    attempts: 1,
  })),
);
const orderForImages = vi.hoisted(() => vi.fn((providers: unknown[]) => providers));
const rateLimit = vi.hoisted(() => vi.fn(async () => {}));
const credits = vi.hoisted(() => ({ debit: vi.fn(async () => ({ ledgerId: "ledger-1", balance: 10 })), refund: vi.fn(async () => {}) }));
const inserted = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/neural-pulse/server/generate", () => ({
  loadProviders,
  SETUP_MESSAGE: "AI writing isn't set up yet. A platform admin needs to add a Gemini, Groq or Anthropic API key in Admin → Social apps.",
  FAILED_MESSAGE: "The AI service didn't return a usable answer. Please try again in a minute.",
}));
vi.mock("@/features/neural-pulse/server/llm", () => ({
  generateJson,
  LlmError: class LlmError extends Error {
    constructor(
      readonly reason: "not_configured" | "failed",
      readonly failures: { provider: string; error: string }[] = [],
    ) {
      super(reason);
      this.name = "LlmError";
    }
  },
}));
vi.mock("@/features/theme/builder/server/generate", () => ({ orderForImages }));
vi.mock("@/features/seller-ai/invoke", () => ({ invokeSellerAi: vi.fn(async () => { throw new Error("edge not mocked"); }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/features/ai-credits/server", () => ({ debitAiCredit: credits.debit, refundAiCredit: credits.refund }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        inserted.rows.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { AppError } from "@/lib/errors";
import { SETUP_MESSAGE } from "@/features/neural-pulse/server/generate";
import { LlmError } from "@/features/neural-pulse/server/llm";
import { productGeneratePrompt } from "@/features/seller-ai/prompts";
import { runSellerAiGeneration } from "@/features/seller-ai/server";

const contentSchema = z.object({
  title: z.string(),
  description: z.string(),
  shortDescription: z.string(),
  tags: z.array(z.string()),
  priceMinor: z.number().int(),
});

describe("runSellerAiGeneration", () => {
  beforeEach(() => {
    loadProviders.mockClear();
    generateJson.mockClear();
    orderForImages.mockClear();
    rateLimit.mockClear();
    credits.debit.mockClear();
    credits.refund.mockClear();
    inserted.rows = [];
    loadProviders.mockResolvedValue([{ id: "gemini" as const, apiKey: "k".repeat(20), model: "gemini-2.0-flash" }]);
    generateJson.mockResolvedValue({
      data: { title: "Silk Saree", description: "Handwoven.", shortDescription: "Festive", tags: ["saree"], priceMinor: 249900 },
      provider: "gemini" as const,
      model: "gemini-2.0-flash",
      tokens: 42,
      attempts: 1,
    });
  });

  it("throws SETUP when no providers are configured (no Edge call)", async () => {
    loadProviders.mockResolvedValueOnce([]);
    await expect(
      runSellerAiGeneration({
        tenantId: "t1",
        userId: "u1",
        feature: "generate_product",
        creditKind: "generate_product",
        input: {},
        prompt: productGeneratePrompt({ hint: "kurta" }),
        schema: contentSchema,
      }),
    ).rejects.toMatchObject({ fieldErrors: { _form: [SETUP_MESSAGE] } });
    expect(credits.debit).not.toHaveBeenCalled();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("debits, calls generateJson in-process, logs, and attaches provider meta", async () => {
    const prompt = productGeneratePrompt({
      hint: "silk saree",
      images: [{ mediaType: "image/jpeg", data: "x".repeat(40) }],
    });
    const r = await runSellerAiGeneration({
      tenantId: "t1",
      userId: "u1",
      feature: "generate_product",
      creditKind: "generate_product",
      input: { imageCount: 1 },
      prompt,
      schema: contentSchema,
    });
    expect(orderForImages).toHaveBeenCalled();
    expect(generateJson).toHaveBeenCalledOnce();
    expect(credits.debit).toHaveBeenCalledWith("t1", "generate_product");
    expect(credits.refund).not.toHaveBeenCalled();
    expect(r.data.title).toBe("Silk Saree");
    expect(r.data.provider).toBe("gemini");
    expect(r.tokens).toBe(42);
    expect(inserted.rows).toHaveLength(1);
  });

  it("refunds credits when generateJson fails", async () => {
    generateJson.mockRejectedValueOnce(new LlmError("failed", [{ provider: "gemini", error: "HTTP 500" }]));
    await expect(
      runSellerAiGeneration({
        tenantId: "t1",
        userId: "u1",
        feature: "generate_blog",
        creditKind: "generate_blog",
        input: {},
        prompt: productGeneratePrompt({ hint: "x" }),
        schema: contentSchema,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(credits.refund).toHaveBeenCalledOnce();
  });
});
