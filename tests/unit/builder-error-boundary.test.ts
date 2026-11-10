import { describe, expect, it } from "vitest";
import { isBuilderNetworkError } from "@/features/theme/site-builder/components/builder-error-boundary";

describe("isBuilderNetworkError", () => {
  it("recognizes Failed to fetch and timeout-style messages", () => {
    expect(isBuilderNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isBuilderNetworkError(new Error("TypeError: Failed to fetch"))).toBe(true);
    expect(isBuilderNetworkError(new Error("timeout of 30000ms exceeded"))).toBe(true);
    expect(isBuilderNetworkError(new Error("net::ERR_TIMED_OUT"))).toBe(true);
    expect(isBuilderNetworkError(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isBuilderNetworkError(new Error("Load failed"))).toBe(true);
  });

  it("returns false for ordinary render/panel bugs", () => {
    expect(isBuilderNetworkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isBuilderNetworkError(new Error("Invalid text look"))).toBe(false);
    expect(isBuilderNetworkError(null)).toBe(false);
  });
});
