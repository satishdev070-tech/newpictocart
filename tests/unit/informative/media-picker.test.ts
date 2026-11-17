import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ requireInformativeTenant: vi.fn() }));
const limits = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const media = vi.hoisted(() => ({ registerImportedImage: vi.fn() }));
const auditMod = vi.hoisted(() => ({ audit: vi.fn() }));
const creds = vi.hoisted(() => ({ getAppCredential: vi.fn(async () => null) }));
vi.mock("@/features/informative/server/context", () => context);
vi.mock("@/lib/rate-limit", () => limits);
vi.mock("@/features/media/server/media", () => media);
vi.mock("@/lib/audit", () => auditMod);
vi.mock("@/features/platform-apps/server", () => creds);

import { clearPickerSearchCache, searchPickerPhotos, toPickerPhoto } from "@/features/informative/media/unsplash";
import { importUnsplashImageAction, searchUnsplashAction } from "@/features/informative/media/actions";
import type { InformativeContext } from "@/features/informative/server/context";

const RAW = "https://images.unsplash.com/photo-1600000000000-abcdef123456?ixid=abc";
const apiPhoto = (id: string, extra: object = {}) => ({
  id,
  alt_description: "a calm dental clinic",
  width: 4000,
  height: 3000,
  color: "#aabbcc",
  urls: { raw: RAW },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download` },
  user: { name: "Asha Rao", links: { html: "https://unsplash.com/@asha" } },
  ...extra,
});

const ctx = { tenantId: "t1", user: { id: "u1" }, permissions: new Set(["content.write", "store.read"]) } as unknown as InformativeContext;

beforeEach(() => {
  clearPickerSearchCache();
  for (const f of [context.requireInformativeTenant, limits.rateLimit, media.registerImportedImage, auditMod.audit]) f.mockReset();
  context.requireInformativeTenant.mockResolvedValue(ctx);
  limits.rateLimit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unsplash search for the picker", () => {
  it("reports 'not set up' without calling the API when there is no key", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(searchPickerPhotos("yoga", 1)).resolves.toEqual({ configured: false, results: [], total: 0, pages: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps the API response (hotlinked images.unsplash.com URLs + attribution) and caches it briefly", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ total: 31, total_pages: 2, results: [apiPhoto("Abc123xyz"), { id: "bad", urls: { raw: "https://evil.example/x.jpg" } }] })));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await searchPickerPhotos("  dental   clinic ", 1, 1000);
    expect(r.configured).toBe(true);
    expect(r.total).toBe(31);
    expect(r.pages).toBe(2);
    expect(r.results).toHaveLength(1);
    const p = r.results[0]!;
    expect(p).toMatchObject({ id: "Abc123xyz", alt: "a calm dental clinic", author: "Asha Rao", credit: "Photo by Asha Rao on Unsplash" });
    expect(new URL(p.thumbUrl).hostname).toBe("images.unsplash.com");
    expect(new URL(p.regularUrl).hostname).toBe("images.unsplash.com");
    expect(p.regularUrl).toContain("w=1080");
    expect(p.authorUrl).toContain("utm_source=");
    const url = new URL(String((fetchSpy.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("query")).toBe("dental clinic");
    expect(((fetchSpy.mock.calls[0] as unknown[])[1] as RequestInit).headers).toMatchObject({ Authorization: "Client-ID test-key" });
    await searchPickerPhotos("Dental Clinic", 1, 2000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("maps photos without a photographer to the Unsplash page", () => {
    const p = toPickerPhoto({ id: "photo-1", source: "curated", alt: "x", base: RAW, thumb: RAW, full: RAW, width: null, height: null, color: null, photographer: null, link: "https://unsplash.com/?utm_source=pictocart", usedFor: [] });
    expect(p).toMatchObject({ author: "Unsplash", authorUrl: "https://unsplash.com/?utm_source=pictocart", credit: "Photo from Unsplash" });
  });

  it("search action requires content.write and validates input", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    expect((await searchUnsplashAction({ query: "x".repeat(200) })).ok).toBe(false);
    context.requireInformativeTenant.mockResolvedValue({ ...ctx, permissions: new Set(["store.read"]) });
    expect(await searchUnsplashAction({ query: "yoga" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("search action returns the not-set-up state", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    expect(await searchUnsplashAction({ query: "yoga" })).toEqual({ ok: true, data: { configured: false, results: [], total: 0, pages: 0 } });
  });
});

describe("importUnsplashImageAction", () => {
  it("rejects URLs and anything that isn't an Unsplash photo id, before touching the tenant", async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const id of ["https://evil.example/x.jpg", "https://images.unsplash.com/photo-1", "../../etc", "a b c d e f", ""]) {
      const r = await importUnsplashImageAction({ id });
      expect(r.ok).toBe(false);
    }
    expect(context.requireInformativeTenant).not.toHaveBeenCalled();
    expect(media.registerImportedImage).not.toHaveBeenCalled();
  });

  it("requires content.write in the member's own tenant", async () => {
    context.requireInformativeTenant.mockResolvedValue({ ...ctx, permissions: new Set(["store.read", "theme.edit"]) });
    expect(await importUnsplashImageAction({ id: "Abc123xyz" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(media.registerImportedImage).not.toHaveBeenCalled();
  });

  it("imports into the tenant's library with the credit in alt, tracks the download and returns the path", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const fetchSpy = vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.hostname === "api.unsplash.com" && u.pathname === "/photos/Abc123xyz") return new Response(JSON.stringify(apiPhoto("Abc123xyz")));
      if (u.hostname === "api.unsplash.com" && u.pathname.endsWith("/download")) return new Response("{}");
      if (u.hostname === "images.unsplash.com") return new Response(jpeg);
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);
    media.registerImportedImage.mockResolvedValue({ id: "m1", path: "tenant/t1/media/a.jpg", url: "https://cdn/a.jpg", alt: "a calm dental clinic (Photo by Asha Rao on Unsplash)" });
    const r = await importUnsplashImageAction({ id: "Abc123xyz" });
    expect(r).toEqual({ ok: true, data: { path: "tenant/t1/media/a.jpg", url: "https://cdn/a.jpg", alt: "a calm dental clinic (Photo by Asha Rao on Unsplash)" } });
    const [tenantId, userId, input] = media.registerImportedImage.mock.calls[0]!;
    expect(tenantId).toBe("t1");
    expect(userId).toBe("u1");
    expect(input).toMatchObject({ folder: "unsplash", alt: "a calm dental clinic (Photo by Asha Rao on Unsplash)", width: 2000, height: 1500 });
    const hosts = fetchSpy.mock.calls.map((c) => new URL(String(c[0])));
    expect(hosts.some((u) => u.pathname === "/photos/Abc123xyz/download")).toBe(true);
    expect(hosts.filter((u) => u.hostname !== "api.unsplash.com").every((u) => u.hostname === "images.unsplash.com")).toBe(true);
    expect(auditMod.audit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", action: "media.unsplash_imported" }));
  });

  it("refuses a photo whose image isn't on images.unsplash.com", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiPhoto("Abc123xyz", { urls: { raw: "https://evil.example/x.jpg" } })))));
    const r = await importUnsplashImageAction({ id: "Abc123xyz" });
    expect(r).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(media.registerImportedImage).not.toHaveBeenCalled();
  });
});
