import { describe, expect, it, vi } from "vitest";
import {
  cookieSiteKey,
  hostsAreSameCookieSite,
  previewCookieNeedsPartitioned,
  previewEntryUrl,
} from "@/features/theme/preview";
import {
  isPreviewDeniedMessage,
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

describe("preview cookie site helpers", () => {
  it("treats pictocart.in and pictocartdev.in as different sites", () => {
    expect(cookieSiteKey("kia-garments.pictocart.in")).toBe("pictocart.in");
    expect(cookieSiteKey("pictocartdev.in")).toBe("pictocartdev.in");
    expect(hostsAreSameCookieSite("kia-garments.pictocart.in", "www.pictocart.in")).toBe(true);
    expect(hostsAreSameCookieSite("kia-garments.pictocart.in", "pictocartdev.in")).toBe(false);
  });

  it("needs Partitioned for cross-site dashboard parents and custom domains", () => {
    expect(previewCookieNeedsPartitioned("kia-garments.pictocart.in", "https://www.pictocart.in", true)).toBe(false);
    expect(previewCookieNeedsPartitioned("kia-garments.pictocart.in", "https://pictocartdev.in", true)).toBe(true);
    expect(previewCookieNeedsPartitioned("shop.example.com", "https://www.pictocart.in", false)).toBe(true);
    expect(previewCookieNeedsPartitioned("kia-garments.pictocart.in", null, true)).toBe(false);
  });
});

describe("previewEntryUrl", () => {
  it("includes parent when provided", () => {
    const url = previewEntryUrl("https://store.example", "tok.sig", "/about", "https://pictocartdev.in");
    expect(url).toContain("token=tok.sig");
    expect(url).toContain("path=%2Fabout");
    expect(url).toContain("parent=https%3A%2F%2Fpictocartdev.in");
  });
});

describe("resolvePreviewEntryUrl", () => {
  const storeOrigin = "https://store.example";
  const path = "/";
  const good = { token: "tok.sig", expiresAt: Math.floor(Date.now() / 1000) + 7200 };

  it("returns the entry URL after mint without fetch preflight", async () => {
    const mint = vi.fn().mockResolvedValue(good);
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: null,
      tokenMarginS: 300,
      parentOrigin: "https://pictocartdev.in",
      mint,
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true, minted: good });
    if (r.ok) {
      expect(r.url).toContain("token=tok.sig");
      expect(r.url).toContain("parent=https%3A%2F%2Fpictocartdev.in");
    }
  });

  it("reuses a fresh existing token", async () => {
    const mint = vi.fn();
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: good,
      tokenMarginS: 300,
      mint,
    });
    expect(mint).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, minted: good });
  });

  it("marks mint failure as soft", async () => {
    const r = await resolvePreviewEntryUrl({
      storeOrigin,
      path,
      existing: null,
      tokenMarginS: 300,
      mint: async () => null,
    });
    expect(r).toEqual({ ok: false, error: "The preview link could not be created.", soft: true });
  });
});
