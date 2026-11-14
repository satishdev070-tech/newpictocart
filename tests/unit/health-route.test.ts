import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports commit, environment and Worker role from deploy metadata", async () => {
    vi.stubEnv("DEPLOY_COMMIT_SHA", "a".repeat(40));
    vi.stubEnv("DEPLOY_ENVIRONMENT", "staging");
    vi.stubEnv("DEPLOY_WORKER_ROLE", "storefront");
    const res = GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, commit: "a".repeat(40), environment: "staging", role: "storefront" });
  });

  it("returns nulls (never throws) when deploy metadata is absent, e.g. local dev", async () => {
    vi.stubEnv("DEPLOY_COMMIT_SHA", undefined);
    vi.stubEnv("DEPLOY_ENVIRONMENT", undefined);
    vi.stubEnv("DEPLOY_WORKER_ROLE", undefined);
    expect(await GET().json()).toEqual({ ok: true, commit: null, environment: null, role: null });
  });
});
