import { describe, expect, it } from "vitest";
import { friendlySellerAiFailure, SELLER_AI_FAILED_MESSAGE } from "@/features/seller-ai/errors";

describe("friendlySellerAiFailure", () => {
  it("maps rejected keys and busy providers", () => {
    expect(friendlySellerAiFailure([{ provider: "gemini", error: "HTTP 403" }])).toMatch(/API key was rejected/);
    expect(friendlySellerAiFailure([{ provider: "nvidia", error: "HTTP 503" }])).toMatch(/busy or timed out/);
    expect(friendlySellerAiFailure([{ provider: "groq", error: "HTTP 404" }])).toMatch(/model isn't available/);
  });

  it("falls back to the generic usable-answer copy", () => {
    expect(friendlySellerAiFailure([{ provider: "nvidia", error: "NVIDIA parse failure: schema: title Required" }])).toBe(SELLER_AI_FAILED_MESSAGE);
    expect(friendlySellerAiFailure([])).toBe(SELLER_AI_FAILED_MESSAGE);
  });
});
