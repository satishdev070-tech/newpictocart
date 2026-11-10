import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_TTL_SECONDS,
  decodePreviewClaims,
  encodePreviewClaims,
  explainPreviewClaims,
} from "@/features/theme/preview";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

describe("explainPreviewClaims", () => {
  const nowMs = 1_700_000_000_000;
  const nowSec = Math.floor(nowMs / 1000);
  const good = encodePreviewClaims({ tenantId: TENANT, userId: USER, expiresAt: nowSec + 60 });

  it("accepts a well-formed unexpired tenant-bound payload", () => {
    expect(explainPreviewClaims(good, TENANT, nowMs)).toEqual({
      ok: true,
      claims: { tenantId: TENANT, userId: USER, expiresAt: nowSec + 60 },
    });
    expect(decodePreviewClaims(good, TENANT, nowMs)?.tenantId).toBe(TENANT);
  });

  it("reports malformed JSON / shape", () => {
    expect(explainPreviewClaims("{", TENANT, nowMs)).toEqual({ ok: false, reason: "malformed" });
    expect(explainPreviewClaims("[]", TENANT, nowMs)).toEqual({ ok: false, reason: "malformed" });
    expect(explainPreviewClaims(JSON.stringify({ t: TENANT, u: USER, x: "soon" }), TENANT, nowMs)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("reports bad_uuid when ids are not UUIDs", () => {
    expect(explainPreviewClaims(JSON.stringify({ t: "not-a-uuid", u: USER, x: nowSec + 60 }), TENANT, nowMs)).toEqual({
      ok: false,
      reason: "bad_uuid",
    });
  });

  it("reports tenant_mismatch without collapsing into expired", () => {
    expect(explainPreviewClaims(good, OTHER, nowMs)).toEqual({ ok: false, reason: "tenant_mismatch" });
  });

  it("reports expired vs not_yet_valid", () => {
    const expired = encodePreviewClaims({ tenantId: TENANT, userId: USER, expiresAt: nowSec - 1 });
    expect(explainPreviewClaims(expired, TENANT, nowMs)).toEqual({ ok: false, reason: "expired" });

    const far = encodePreviewClaims({
      tenantId: TENANT,
      userId: USER,
      expiresAt: nowSec + PREVIEW_TTL_SECONDS + 120,
    });
    expect(explainPreviewClaims(far, TENANT, nowMs)).toEqual({ ok: false, reason: "not_yet_valid" });
  });
});

describe("diagnosePreviewToken (HMAC)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/env/server", () => ({
      serverEnv: () => ({ APP_SECRET: "unit-test-app-secret-with-32-plus-chars!!" }),
    }));
  });

  it("round-trips mint+verify and reports sig_fail for the wrong secret", async () => {
    const { createPreviewToken, diagnosePreviewToken } = await import("@/features/theme/server/preview");
    const { token } = createPreviewToken(TENANT, USER);
    expect(diagnosePreviewToken(token, TENANT).ok).toBe(true);
    expect(diagnosePreviewToken(token, OTHER)).toEqual({ ok: false, reason: "tenant_mismatch" });
    expect(diagnosePreviewToken("aaaa.bbbb", TENANT)).toEqual({ ok: false, reason: "sig_fail" });

    vi.resetModules();
    vi.doMock("@/lib/env/server", () => ({
      serverEnv: () => ({ APP_SECRET: "other-unit-test-app-secret-32-chars-min" }),
    }));
    const other = await import("@/features/theme/server/preview");
    expect(other.diagnosePreviewToken(token, TENANT)).toEqual({ ok: false, reason: "sig_fail" });
  });
});
