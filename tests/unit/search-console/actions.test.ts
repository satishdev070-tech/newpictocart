import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ saveGscFile: vi.fn(), removeGscFile: vi.fn(), saveGscDns: vi.fn(), removeGscDns: vi.fn(), checkGscDelivery: vi.fn(), checkGscDns: vi.fn() }));
const access = vi.hoisted(() => ({ getPlatformContext: vi.fn() }));
const limits = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/features/search-console/server/store", () => store);
vi.mock("@/lib/platform/access", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    getPlatformContext: access.getPlatformContext,
    assertPlatformPermission: (ctx: { permissions: ReadonlySet<string> }, p: string) => {
      if (!ctx.permissions.has(p)) throw new AppError("FORBIDDEN");
    },
  };
});
vi.mock("@/lib/rate-limit", () => limits);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { checkGscDeliveryAction, checkGscDnsAction, removeGscDnsAction, removeGscFileAction, saveGscDnsAction, uploadGscFileAction } from "@/features/search-console/actions";
import { PLATFORM_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";
import { AppError } from "@/lib/errors";

const NAME = "googlea53e7e51ec71d7b4.html";
const CONTENT = readFileSync(new URL(`./fixtures/${NAME}`, import.meta.url), "utf8");
const superAdmin = { user: { id: "u-super" }, role: "super_admin", permissions: PLATFORM_ROLE_PERMISSIONS.super_admin };
const support = { user: { id: "u-support" }, role: "support", permissions: PLATFORM_ROLE_PERMISSIONS.support };

function upload(domain: string, name: string, text: string) {
  const fd = new FormData();
  fd.set("domain", domain);
  fd.set("file", new File([text], name, { type: "text/html" }));
  return uploadGscFileAction(null, fd);
}
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  access.getPlatformContext.mockResolvedValue(superAdmin);
  limits.rateLimit.mockResolvedValue(undefined);
});

describe("upload", () => {
  it("saves a valid file for the chosen domain", async () => {
    expect(await upload("production", NAME, CONTENT)).toEqual({ ok: true, data: undefined });
    expect(store.saveGscFile).toHaveBeenCalledWith(superAdmin, "production", { filename: NAME, content: CONTENT });
    expect(limits.rateLimit).toHaveBeenCalledWith("platform-gsc-write", "u-super", 20, 600);
  });

  it("keeps production and staging separate", async () => {
    await upload("staging", NAME, CONTENT);
    expect(store.saveGscFile).toHaveBeenCalledWith(superAdmin, "staging", expect.anything());
    const res = await upload("acme", NAME, CONTENT);
    expect(res.ok).toBe(false);
    expect(store.saveGscFile).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid name, oversized file and content mismatch without saving", async () => {
    for (const [name, text] of [
      ["index.html", CONTENT],
      ["../" + NAME, CONTENT],
      [NAME, CONTENT + "x".repeat(10 * 1024)],
      [NAME, "google-site-verification: google0000000000000000.html"],
      [NAME, `<script>alert(1)</script>`],
    ] as const) {
      const res = await upload("production", name, text);
      expect(res.ok, name).toBe(false);
      if (!res.ok) expect(res.error.fieldErrors?.file?.[0], name).toBeTruthy();
    }
    expect(store.saveGscFile).not.toHaveBeenCalled();
  });

  it("is super-admin only", async () => {
    access.getPlatformContext.mockResolvedValue(support);
    const res = await upload("production", NAME, CONTENT);
    expect(res).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    access.getPlatformContext.mockResolvedValue(null);
    expect(await upload("production", NAME, CONTENT)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(store.saveGscFile).not.toHaveBeenCalled();
  });

  it("surfaces rate limiting", async () => {
    limits.rateLimit.mockRejectedValue(new AppError("RATE_LIMITED"));
    expect(await upload("production", NAME, CONTENT)).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    expect(store.saveGscFile).not.toHaveBeenCalled();
  });
});

describe("replace, remove and DNS", () => {
  it("replacing re-uploads to the same domain; remove targets only that domain", async () => {
    await upload("production", NAME, CONTENT);
    await upload("production", "google0123456789abcdef.html", "google-site-verification: google0123456789abcdef.html\n");
    expect(store.saveGscFile).toHaveBeenLastCalledWith(superAdmin, "production", { filename: "google0123456789abcdef.html", content: "google-site-verification: google0123456789abcdef.html\n" });
    expect((await removeGscFileAction(null, form({ domain: "staging" }))).ok).toBe(true);
    expect(store.removeGscFile).toHaveBeenCalledWith(superAdmin, "staging");
  });

  it("normalises and saves the TXT value; removes it", async () => {
    expect((await saveGscDnsAction(null, form({ domain: "production", value: '"google-site-verification=ZTHsfVTDELaOSswov8ZoSfuNLjSzTJKRjAF"' }))).ok).toBe(true);
    expect(store.saveGscDns).toHaveBeenCalledWith(superAdmin, "production", "google-site-verification=ZTHsfVTDELaOSswov8ZoSfuNLjSzTJKRjAF");
    expect((await saveGscDnsAction(null, form({ domain: "production", value: "not a token" }))).ok).toBe(false);
    expect((await removeGscDnsAction(null, form({ domain: "production" }))).ok).toBe(true);
    expect(store.removeGscDns).toHaveBeenCalledWith(superAdmin, "production");
  });

  it("checks run on demand with their own (tighter) rate limit and are super-admin only", async () => {
    store.checkGscDns.mockResolvedValue("found");
    store.checkGscDelivery.mockResolvedValue({ ok: true, reason: null, url: `https://www.pictocart.in/${NAME}` });
    expect(await checkGscDnsAction(null, form({ domain: "production" }))).toEqual({ ok: true, data: "found" });
    expect(await checkGscDeliveryAction(null, form({ domain: "production" }))).toMatchObject({ ok: true, data: { ok: true } });
    expect(limits.rateLimit).toHaveBeenCalledWith("platform-gsc-check", "u-super", 10, 60);
    access.getPlatformContext.mockResolvedValue(support);
    expect(await checkGscDnsAction(null, form({ domain: "production" }))).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
