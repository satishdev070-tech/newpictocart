import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env/server", () => ({
  serverEnv: () => ({ SUPABASE_SECRET_KEY: "test-secret-key-1234567890" }),
}));
vi.mock("@/lib/env/public", () => ({
  publicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
}));

describe("invokeEdgeFunction", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("POSTs to functions/v1 with the secret bearer", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    const { invokeEdgeFunction } = await import("./edge");
    const r = await invokeEdgeFunction("generate-product", { imageUrls: ["https://x.test/a.jpg"] });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/functions/v1/generate-product");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-secret-key-1234567890");
  });

  it("returns ok:false on HTTP errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: "generation_failed", message: "all providers failed" }),
    });
    const { invokeEdgeFunction } = await import("./edge");
    const r = await invokeEdgeFunction("generate-product", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(502);
      expect(r.error).toContain("all providers failed");
    }
  });
});
