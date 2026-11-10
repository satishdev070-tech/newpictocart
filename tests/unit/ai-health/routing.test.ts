import { describe, expect, it } from "vitest";
import { routeProviders } from "@/features/ai-health/routing";
import type { FeatureRoute } from "@/features/ai-health/registry";

const gemini = { id: "gemini" as const, apiKey: "g", model: "gemini-default" };
const groq = { id: "groq" as const, apiKey: "q", model: "groq-default" };
const anthropic = { id: "anthropic" as const, apiKey: "a", model: "claude-default" };
const all = [gemini, groq, anthropic];

const route = (r: Partial<FeatureRoute>): FeatureRoute => ({ featureKey: "caption", primaryProvider: "anthropic", primaryModel: null, fallbackProvider: null, fallbackModel: null, enabled: true, ...r });
const ids = (ps: { id: string; model: string }[]) => ps.map((p) => `${p.id}:${p.model}`);

describe("routeProviders", () => {
  it("keeps the platform order without a route or with a disabled one", () => {
    expect(ids(routeProviders(all, null))).toEqual(["gemini:gemini-default", "groq:groq-default", "anthropic:claude-default"]);
    expect(ids(routeProviders(all, route({ enabled: false, primaryProvider: "groq" })))).toEqual(["gemini:gemini-default", "groq:groq-default", "anthropic:claude-default"]);
  });

  it("uses primary then fallback, then the rest of the platform order", () => {
    const r = routeProviders(all, route({ primaryProvider: "anthropic", primaryModel: "claude-x", fallbackProvider: "groq", fallbackModel: "llama-y" }));
    expect(ids(r)).toEqual(["anthropic:claude-x", "groq:llama-y", "gemini:gemini-default"]);
    expect(r[0]?.apiKey).toBe("a");
  });

  it("falls back to the provider's configured model when the route leaves it blank", () => {
    expect(ids(routeProviders(all, route({ primaryProvider: "groq", fallbackProvider: "gemini" })))).toEqual(["groq:groq-default", "gemini:gemini-default", "anthropic:claude-default"]);
  });

  it("drops providers without a key, then appends other configured ones", () => {
    expect(ids(routeProviders([gemini, groq], route({ primaryProvider: "anthropic", fallbackProvider: "groq", fallbackModel: "m2" })))).toEqual(["groq:m2", "gemini:gemini-default"]);
  });

  it("uses the platform order when none of the routed providers is configured", () => {
    expect(ids(routeProviders([gemini], route({ primaryProvider: "anthropic", fallbackProvider: "groq" })))).toEqual(["gemini:gemini-default"]);
  });

  it("allows the same provider with two models, but not a duplicate id in the safety net", () => {
    expect(ids(routeProviders(all, route({ primaryProvider: "gemini", primaryModel: "pro", fallbackProvider: "gemini", fallbackModel: "flash" })))).toEqual([
      "gemini:pro",
      "gemini:flash",
      "groq:groq-default",
      "anthropic:claude-default",
    ]);
    expect(ids(routeProviders(all, route({ primaryProvider: "gemini", fallbackProvider: "gemini" })))).toEqual([
      "gemini:gemini-default",
      "groq:groq-default",
      "anthropic:claude-default",
    ]);
  });

  it("still reaches NVIDIA when Admin left the route on a dead Gemini-only key", () => {
    const nvidia = { id: "nvidia" as const, apiKey: "n", model: "nemotron" };
    const list = [nvidia, gemini, groq];
    expect(ids(routeProviders(list, route({ primaryProvider: "gemini", primaryModel: null, fallbackProvider: null })))).toEqual([
      "gemini:gemini-default",
      "nvidia:nemotron",
      "groq:groq-default",
    ]);
  });

  it("does not mutate the configured list", () => {
    const list = [gemini, groq];
    routeProviders(list, route({ primaryProvider: "groq", primaryModel: "x" }));
    expect(list[1]?.model).toBe("groq-default");
  });
});
