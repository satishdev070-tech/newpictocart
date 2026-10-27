import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_FEATURES, ROUTABLE_FEATURE_KEYS, findFeature } from "@/features/ai-health/registry";
import { aiHealthTab, featureRouteSchema, modelPriceSchema, testModelSchema, tokenCostMinor } from "@/features/ai-health/schemas";

const SCHEMAS = readFileSync(new URL("../../../src/features/neural-pulse/schemas.ts", import.meta.url), "utf8");
const MIGRATION = [
  readFileSync(new URL("../../../supabase/migrations/20261025003900_ai_economy.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../../../supabase/migrations/20261028004200_seller_ai_blog_contact.sql", import.meta.url), "utf8"),
].join("\n");

describe("AI feature registry", () => {
  it("lists every Neural Pulse GenerationKind plus the section, seed and voice features", () => {
    const kinds = /export type GenerationKind = ([^;]+);/.exec(SCHEMAS)?.[1]?.match(/"([a-z_]+)"/g)?.map((k) => k.slice(1, -1)) ?? [];
    expect(kinds.length).toBeGreaterThan(5);
    for (const k of kinds) expect(findFeature(k), k).toBeDefined();
    for (const k of ["section", "onboarding_seed", "voice_onboarding", "theme_builder", "generate_blog", "draft_contact_reply"]) expect(findFeature(k), k).toBeDefined();
    expect(new Set(AI_FEATURES.map((f) => f.key)).size).toBe(AI_FEATURES.length);
  });

  it("only routes features that go through loadProviders; Sarvam-only ones are fixed", () => {
    expect(findFeature("onboarding_seed")?.routable).toBe(false);
    expect(findFeature("voice_onboarding")?.routable).toBe(false);
    expect(ROUTABLE_FEATURE_KEYS).toContain("section");
    expect(ROUTABLE_FEATURE_KEYS).toContain("generate_blog");
    expect(ROUTABLE_FEATURE_KEYS).toContain("draft_contact_reply");
    for (const k of ROUTABLE_FEATURE_KEYS) expect(k).toMatch(/^[a-z_]{2,60}$/);
  });

  it("every credit kind has a seeded action cost", () => {
    for (const f of AI_FEATURES) if (f.creditKind) expect(MIGRATION, f.creditKind).toContain(`('${f.creditKind}',`);
  });
});


describe("AI health schemas", () => {
  it("parses a route form and blanks optional models", () => {
    const r = featureRouteSchema.parse({ featureKey: "caption", primaryProvider: "anthropic", primaryModel: " claude-opus-5-5 ", fallbackProvider: "none", fallbackModel: "", enabled: "on" });
    expect(r).toEqual({ featureKey: "caption", primaryProvider: "anthropic", primaryModel: "claude-opus-5-5", fallbackProvider: undefined, fallbackModel: undefined, enabled: true });
    expect(featureRouteSchema.parse({ featureKey: "caption", primaryProvider: "groq" }).enabled).toBe(false);
  });

  it("rejects unknown features, providers, bad models and a fallback equal to the primary", () => {
    expect(featureRouteSchema.safeParse({ featureKey: "voice_onboarding", primaryProvider: "gemini" }).success).toBe(false);
    expect(featureRouteSchema.safeParse({ featureKey: "caption", primaryProvider: "openai" }).success).toBe(false);
    expect(featureRouteSchema.safeParse({ featureKey: "caption", primaryProvider: "gemini", primaryModel: "bad model!" }).success).toBe(false);
    expect(featureRouteSchema.safeParse({ featureKey: "caption", primaryProvider: "gemini", fallbackProvider: "gemini" }).success).toBe(false);
    expect(featureRouteSchema.safeParse({ featureKey: "caption", primaryProvider: "gemini", fallbackModel: "x-model" }).success).toBe(false);
    expect(featureRouteSchema.safeParse({ featureKey: "caption", primaryProvider: "gemini", primaryModel: "a1", fallbackProvider: "gemini", fallbackModel: "b2" }).success).toBe(true);
  });

  it("converts ₹ per 1M tokens to paise and computes cost", () => {
    expect(modelPriceSchema.parse({ provider: "gemini", model: "gemini-3.8-flash", pricePerMillionMinor: "12.50" }).pricePerMillionMinor).toBe(1250);
    expect(modelPriceSchema.safeParse({ provider: "gemini", model: "m1", pricePerMillionMinor: "-1" }).success).toBe(false);
    expect(modelPriceSchema.safeParse({ provider: "nvidia", model: "m1", pricePerMillionMinor: "1" }).success).toBe(false);
    expect(tokenCostMinor(2_000_000, 1250)).toBe(2500);
    expect(tokenCostMinor(321, 1250)).toBe(0);
    expect(tokenCostMinor(500_000, 101)).toBe(51);
    expect(tokenCostMinor(0, 1000)).toBe(0);
  });

  it("test input takes one LLM provider; tabs default to features", () => {
    expect(testModelSchema.safeParse({ provider: "sarvam" }).success).toBe(false);
    expect(testModelSchema.parse({ provider: "groq", model: "", featureKey: "ideas" })).toEqual({ provider: "groq", model: undefined, featureKey: "ideas" });
    expect(aiHealthTab("models")).toBe("models");
    expect(aiHealthTab("x")).toBe("features");
  });
});
