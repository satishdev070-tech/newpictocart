import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const env = vi.hoisted(() => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_key_1234567890",
  AI_EDGE_INVOKE_SECRET: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => env }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { AppError } from "@/lib/errors";
import { invokeSellerAi, SELLER_AI_EDGE_UNAVAILABLE, SELLER_AI_SETUP } from "@/features/seller-ai/invoke";

const schema = z.object({ ok: z.literal(true) });
const providers = [{ id: "gemini" as const, apiKey: "gemini-secret-key", model: "gemini-2.0-flash" }];

describe("invokeSellerAi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    env.AI_EDGE_INVOKE_SECRET = undefined;
  });

  it("sends apikey and Authorization headers", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await invokeSellerAi("generate-blog", providers, { topic: "x" }, schema);
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.apikey).toBe(env.SUPABASE_SECRET_KEY);
    expect(headers.authorization).toBe(`Bearer ${env.SUPABASE_SECRET_KEY}`);
  });

  it("maps only error=not_configured to SETUP, not bare 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not_configured" }), { status: 503 })));
    await expect(invokeSellerAi("generate-blog", providers, {}, schema)).rejects.toMatchObject({
      fieldErrors: { _form: [SELLER_AI_SETUP] },
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "boom" }), { status: 503 })));
    const err = await invokeSellerAi("generate-blog", providers, {}, schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).fieldErrors?._form?.[0]).toBe(SELLER_AI_EDGE_UNAVAILABLE);
    expect((err as AppError).context?.reason).toBe("edge_unavailable");
  });

  it("maps 502 to edge unavailable, not SETUP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "generation_failed" }), { status: 502 })));
    const err = await invokeSellerAi("generate-product", providers, {}, schema).catch((e: unknown) => e);
    expect((err as AppError).fieldErrors?._form?.[0]).toBe(SELLER_AI_EDGE_UNAVAILABLE);
  });

  it("throws SETUP when Next has no providers", async () => {
    await expect(invokeSellerAi("business-coach", [], {}, schema)).rejects.toMatchObject({
      fieldErrors: { _form: [SELLER_AI_SETUP] },
    });
  });
});
