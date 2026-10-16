import { afterEach, describe, expect, it, vi } from "vitest";
import { curatedPhoto, fromApiPhoto, importedFilename, isDownloadLocation, isUnsplashImageUrl, mergePhotos, scaledSize, unsplashCredit } from "@/features/media/unsplash/photos";
import { featuredUnsplashPhotos, resolveUnsplashPhoto, searchUnsplash, trackUnsplashDownload } from "@/features/media/unsplash/server";
import { UNSPLASH_CATEGORIES, curatedUnsplashPhotos } from "@/lib/unsplash";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const apiPhoto = {
  id: "abc123XYZ",
  alt_description: "a red saree",
  width: 4000,
  height: 3000,
  color: "#a0b0c0",
  urls: { raw: "https://images.unsplash.com/photo-1?ixid=x" },
  links: { html: "https://unsplash.com/photos/abc123XYZ", download_location: "https://api.unsplash.com/photos/abc123XYZ/download?ixid=x" },
  user: { name: "Asha Rao", links: { html: "https://unsplash.com/@asha" } },
};

describe("unsplash photo helpers", () => {
  it("normalises API photos with credit links and hotlinked sizes", () => {
    const p = fromApiPhoto(apiPhoto, ["Fashion themes"])!;
    expect(p.id).toBe("abc123XYZ");
    expect(p.thumb).toMatch(/^https:\/\/images\.unsplash\.com\/photo-1\?ixid=x&w=400/);
    expect(p.photographer).toEqual({ name: "Asha Rao", url: "https://unsplash.com/@asha?utm_source=pictocart&utm_medium=referral" });
    expect(p.link).toContain("utm_source=pictocart");
    expect(unsplashCredit(p)).toBe("Photo by Asha Rao on Unsplash");
    expect(p.usedFor).toEqual(["Fashion themes"]);
  });

  it("rejects photos that aren't hosted on images.unsplash.com", () => {
    expect(fromApiPhoto({ ...apiPhoto, urls: { raw: "https://evil.example/x.jpg" } })).toBeNull();
    expect(fromApiPhoto({ ...apiPhoto, id: "../x" })).toBeNull();
    expect(isUnsplashImageUrl("http://images.unsplash.com/x")).toBe(false);
    expect(isDownloadLocation(apiPhoto.links.download_location)).toBe(true);
    expect(isDownloadLocation("https://evil.example/photos/a/download")).toBe(false);
    expect(isDownloadLocation("https://api.unsplash.com/me")).toBe(false);
  });

  it("builds file names, sizes and merged lists", () => {
    expect(importedFilename({ id: "abc123XYZ", photographer: { name: "Asha Rao", url: "" } })).toBe("unsplash-asha-rao-abc123XYZ.jpg");
    expect(importedFilename({ id: "photo-1", photographer: null })).toBe("unsplash-photo-1.jpg");
    expect(scaledSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(scaledSize(1000, 500, 2000)).toEqual({ width: 1000, height: 500 });
    expect(scaledSize(null, 500, 2000)).toEqual({ width: null, height: null });
    const a = curatedPhoto("photo-1", "x", ["A"]);
    expect(mergePhotos([a, curatedPhoto("photo-1", "x", ["B"])])[0]!.usedFor).toEqual(["A", "B"]);
  });
});

describe("unsplash media server", () => {
  it("lists the curated theme/category photos without a key and never calls the API", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const photos = await featuredUnsplashPhotos();
    expect(photos.length).toBe(UNSPLASH_CATEGORIES.length);
    expect(photos.every((p) => p.source === "curated" && p.usedFor.length > 0)).toBe(true);
    expect(photos.find((p) => p.usedFor.some((u) => u.includes("Fashion")))).toBeTruthy();
    const search = await searchUnsplash("bread", 1);
    expect(search.photos.map((p) => p.alt.toLowerCase()).join()).toContain("bread");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("searches through the API with the key and the safe-content filter", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "k");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ total: 1, total_pages: 1, results: [apiPhoto] })));
    vi.stubGlobal("fetch", fetch);
    const r = await searchUnsplash("saree", 2);
    expect(r.photos).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("query=saree");
    expect(url).toContain("page=2");
    expect(url).toContain("content_filter=high");
    expect((init.headers as Record<string, string>).Authorization).toBe("Client-ID k");
  });

  it("only resolves curated ids from the curated list, and API ids through the API", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "k");
    const fetch = vi.fn(async () => new Response(JSON.stringify(apiPhoto)));
    vi.stubGlobal("fetch", fetch);
    const curated = curatedUnsplashPhotos()[0]!;
    expect((await resolveUnsplashPhoto(curated.id))?.imageUrl).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(await resolveUnsplashPhoto("photo-1234567890123-abcdef12")).toBeNull();
    const r = await resolveUnsplashPhoto("abc123XYZ");
    expect(r?.downloadLocation).toBe(apiPhoto.links.download_location);
    expect(r?.imageUrl).toContain("fm=jpg");
  });

  it("tracks downloads only on api.unsplash.com", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "k");
    const fetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await trackUnsplashDownload("https://evil.example/photos/a/download");
    await trackUnsplashDownload(null);
    expect(fetch).not.toHaveBeenCalled();
    await trackUnsplashDownload(apiPhoto.links.download_location);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
