import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldSample } from "@/lib/observability/sampling";

describe("shouldSample", () => {
  const prev = process.env.OBSERVABILITY_ENABLED;

  beforeEach(() => {
    process.env.OBSERVABILITY_ENABLED = "true";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.OBSERVABILITY_ENABLED;
    else process.env.OBSERVABILITY_ENABLED = prev;
  });

  it("returns false when disabled (unless force)", () => {
    process.env.OBSERVABILITY_ENABLED = "false";
    expect(shouldSample({ route: "/dashboard", status: 500, durationMs: 9000 })).toBe(false);
    expect(shouldSample({ route: "/x", status: 200, durationMs: 10, force: true })).toBe(true);
  });

  it("always samples errors, slow requests, and allowlisted routes", () => {
    expect(shouldSample({ route: "/api/x", status: 500, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/api/x", status: 429, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/api/x", status: 200, durationMs: 800, slowMs: 800, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/dashboard/products", status: 200, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/login", status: 200, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/seller/login", status: 200, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/admin/health", status: 200, durationMs: 10, sampleRate: 0, random: () => 0.99 })).toBe(true);
  });

  it("applies the sample rate otherwise", () => {
    expect(shouldSample({ route: "/storefront", status: 200, durationMs: 50, sampleRate: 0, random: () => 0 })).toBe(false);
    expect(shouldSample({ route: "/storefront", status: 200, durationMs: 50, sampleRate: 1, random: () => 0.99 })).toBe(true);
    expect(shouldSample({ route: "/storefront", status: 200, durationMs: 50, sampleRate: 0.2, random: () => 0.1 })).toBe(true);
    expect(shouldSample({ route: "/storefront", status: 200, durationMs: 50, sampleRate: 0.2, random: () => 0.5 })).toBe(false);
  });
});
