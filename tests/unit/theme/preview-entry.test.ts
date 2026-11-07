import { describe, expect, it, vi } from "vitest";
import {
  isPreviewDeniedMessage,
  preflightPreviewEntry,
  previewDenyReasonFromHtml,
  resolvePreviewEntryUrl,
  tokenOf,
} from "@/features/theme/site-builder/preview-entry";

describe("tokenOf / previewDenyReasonFromHtml / isPreviewDeniedMessage", () => {
  it("reads the token from a preview entry URL", () => {
    expect(tokenOf("https://store.example/preview?token=abc.def&path=%2F")).toBe("abc.def");
    expect(tokenOf("not a url")).toBeNull();
  });

  it("parses data-preview-error from 403 HTML", () => {
    expect(previewDenyReasonFromHtml(`<body data-preview-error="sig_fail">x</body>`)).toBe("sig_fail");
    expect(previewDenyReasonFromHtml("<body>nope</body>")).toBeNull();
  });

  it("recognises deny postMessages", () => {
    expect(isPreviewDeniedMessage({ source: "pictocart-preview", type: "denied", reason: "sig_fail" })).toBe(true);
    expect(isPreviewDeniedMessage({ source: "other", type: "denied" })).toBe(false);
    expect(isPreviewDeniedMessage(null)).toBe(false);
  });
});

describe("preflightPreviewEntry", () => {
  it("accepts redirect statuses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 307, text: async () => "" });
    await expect(preflightPreviewEntry("https://s.example/preview?token=t", fetchImpl)).resolves.toEqual({ ok: true });
  });

  it("returns denied with reason from 403 HTML", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 403,
      text: async () => `<body data-preview-error="tenant_mismatch"></body>`,
    });
    await expect(preflightPreviewEntry("https://s.example/preview?token=t", fetchImpl)).resolves.toEqual({
      ok: false,
      kind: "denied",
      reason: "tenant_mismatch",
    });
  });

  it("treats network errors as soft failures", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(preflightPreviewEntry("https://s.example/preview?token=t", fetchImpl)).resolves.toEqual({
      ok: false,
      kind: "network",
    });
  });
});

describe("resolvePreviewEntryUrl", () => {
  const storeOrigin = "https://store.example";
  const path = "/";
  const good = { token: "tok.sig", expiresAt: Math.floor(Date.now() / 1000) + 7200 };

  it("returns the entry URL when preflight redirects", async () => {
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: good,
      tokenMarginS: 300,
      mint: async () => good,
      preflight: async () => ({ ok: true }),
    });
    expect(r).toMatchObject({ ok: true, minted: good });
    if (r.ok) expect(r.url).toContain("token=tok.sig");
  });

  it("remints once on deny then surfaces Preview blocked", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce({ token: "old.sig", expiresAt: good.expiresAt })
      .mockResolvedValueOnce({ token: "new.sig", expiresAt: good.expiresAt });
    const preflight = vi.fn().mockResolvedValue({ ok: false, kind: "denied", reason: "sig_fail" });
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: null,
      tokenMarginS: 300,
      mint,
      preflight,
    });
    expect(mint).toHaveBeenCalledTimes(2);
    expect(preflight).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: false, error: "Preview blocked (sig_fail). Retry to continue." });
  });

  it("marks network failures as soft", async () => {
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: good,
      tokenMarginS: 300,
      mint: async () => good,
      preflight: async () => ({ ok: false, kind: "network" }),
    });
    expect(r).toMatchObject({ ok: false, soft: true });
  });
});
