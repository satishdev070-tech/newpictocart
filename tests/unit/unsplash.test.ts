import { afterEach, describe, expect, it, vi } from "vitest";
import { INDUSTRY_SLUGS } from "@/features/stores/industries";
import { UNSPLASH_CATEGORIES, fallbackCategoryImage, getCategoryImage, getCategoryImages, toUnsplashCategory } from "@/lib/unsplash";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("toUnsplashCategory", () => {
  it("keeps known categories and maps industries and aliases", () => {
    for (const c of UNSPLASH_CATEGORIES) expect(toUnsplashCategory(c)).toBe(c);
    expect(toUnsplashCategory("gourmet")).toBe("food");
    expect(toUnsplashCategory("home-decor")).toBe("furniture");
    expect(toUnsplashCategory("Home Decor")).toBe("furniture");
    expect(toUnsplashCategory("Jewelry")).toBe("jewellery");
    expect(toUnsplashCategory("something-new")).toBe("general");
  });

  it("gives every store industry a curated Unsplash photo", () => {
    for (const slug of INDUSTRY_SLUGS) {
      const img = fallbackCategoryImage(slug);
      expect(img.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/);
      expect(img.alt).not.toBe("");
    }
  });
});

describe("getCategoryImage", () => {
  it("uses the curated fallback without calling the API when no key is set", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const img = await getCategoryImage("fashion");
    expect(img).toEqual(fallbackCategoryImage("fashion"));
    expect(img.source).toBe("fallback");
    expect(img.photographer).toBeNull();
    expect(img.unsplashUrl).toContain("utm_source=pictocart");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back when the API errors or returns nothing", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 403 })));
    expect(await getCategoryImage("beauty")).toEqual(fallbackCategoryImage("beauty"));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [] })));
    expect(await getCategoryImage("beauty")).toEqual(fallbackCategoryImage("beauty"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await getCategoryImage("beauty")).toEqual(fallbackCategoryImage("beauty"));
  });

  it("returns the API photo with attribution and a cached, authenticated request", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    const fetchSpy = vi.fn(async (..._args: unknown[]) =>
      Response.json({
        results: [{ alt_description: "a cake", urls: { raw: "https://images.unsplash.com/photo-1?ixid=abc" }, user: { name: "Asha", links: { html: "https://unsplash.com/@asha" } } }],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const img = await getCategoryImage("gourmet");
    expect(img.source).toBe("api");
    expect(img.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-1\?ixid=abc&w=800/);
    expect(img.alt).toBe("a cake");
    expect(img.photographer).toEqual({ name: "Asha", url: "https://unsplash.com/@asha?utm_source=pictocart&utm_medium=referral" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit & { next?: { revalidate?: number } }];
    expect(url).toContain("api.unsplash.com/search/photos");
    expect(url).toContain("query=bakery");
    expect((init.headers as Record<string, string>).Authorization).toBe("Client-ID test-key");
    expect(init.next?.revalidate).toBeGreaterThanOrEqual(86400);
  });

  it("rejects non-Unsplash image hosts from the API", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [{ urls: { raw: "https://evil.example/x.jpg" } }] })));
    expect(await getCategoryImage("toys")).toEqual(fallbackCategoryImage("toys"));
  });

  it("looks up several categories at once", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    const map = await getCategoryImages(["fashion", "electronics", "fashion"]);
    expect([...map.keys()]).toEqual(["fashion", "electronics"]);
    expect(map.get("electronics")?.url).toContain("images.unsplash.com");
  });
});
