import { describe, expect, it } from "vitest";
import { fillThemeImages, imageCredits, imageSlotsFor } from "@/features/theme/builder/images";
import { extractColors, mapFontToKey, stylesheetLinks, summarizeReference } from "@/features/theme/builder/extract";
import { themeImageSchema } from "@/features/theme/builder/schema";
import type { HomeItem } from "@/features/theme/marketplace/types";
import type { StockImage, StockSlot } from "@/lib/unsplash-stock";

const photo = (slot: StockSlot, i: number): StockImage => ({
  id: `photo-${slot}${i}-abcdef`,
  url: `https://images.unsplash.com/photo-${slot}${i}-abcdef?auto=format&fit=crop`,
  alt: `${slot} photo ${i}`,
  photographer: { name: `Photographer ${slot} ${i}`, url: `https://unsplash.com/@p${i}?utm_source=pictocart` },
  unsplashUrl: "https://unsplash.com/?utm_source=pictocart",
  slot,
  category: "food",
  source: "api",
});

const home: HomeItem[] = [
  ["Hero", { variant: "split" }],
  ["CategoryGrid", {}],
  ["ProductGrid", {}],
  ["BrandStory", {}],
  ["Testimonials", {}],
  ["Newsletter", { variant: "split" }],
];

describe("theme builder: Unsplash fill", () => {
  it("lists every image slot in page order", () => {
    expect(imageSlotsFor({ home }).map((s) => `${s.section}:${s.slot}x${s.count}`)).toEqual(["0:herox3", "1:tilesx6", "2:productsx4", "3:storyx2", "5:storyx1"]);
  });

  it("fills every slot from the theme's category, once per stock slot, keeping credits", async () => {
    const asked: string[] = [];
    const images = await fillThemeImages({ home, family: "food" }, "gourmet", async (cat, slot, n) => {
      asked.push(`${cat}/${slot}/${n}`);
      return Array.from({ length: Math.min(n, 5) }, (_, i) => photo(slot, i));
    });
    expect(asked.sort()).toEqual(["food/hero/4", "food/products/4", "food/story/4", "food/tiles/6"]);
    for (const s of imageSlotsFor({ home })) expect(images.filter((i) => i.section === s.section)).toHaveLength(s.count);
    for (const i of images) {
      expect(themeImageSchema.safeParse(i).success).toBe(true);
      expect(i.photographer?.name).toBeTruthy();
      expect(i.url.startsWith("https://images.unsplash.com/")).toBe(true);
    }
    // Story photos aren't repeated while the pool lasts (2 for BrandStory + 1 for Newsletter, pool of 4).
    const story = images.filter((i) => i.slot === "story").map((i) => i.id);
    expect(new Set(story).size).toBe(story.length);
    expect(imageCredits(images).length).toBeGreaterThan(3);
  });

  it("borrows hero photos when a slot comes back empty, and never throws on fetch errors", async () => {
    const images = await fillThemeImages({ home }, "furniture", async (_c, slot) => {
      if (slot === "tiles") throw new Error("rate limited");
      return slot === "hero" ? [photo("hero", 1), photo("hero", 2)] : [];
    });
    expect(images.filter((i) => i.section === 1)).toHaveLength(6);
    expect(images.every((i) => i.slot === "hero")).toBe(true);
    expect(await fillThemeImages({ home }, "fashion", async () => [])).toEqual([]);
  });
});

const PAGE = `<!doctype html><html><head>
<meta name="theme-color" content="#0F3D2E">
<link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="https://cdn.other.com/x.css">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400&amp;family=Jost&display=swap" rel="stylesheet">
<style>body{background:#0b0b0c;color:#f5f0e8} h2{text-transform:uppercase} .btn{border-radius:999px;background:#C9A227}</style>
<script>var secret = "#ff0000";</script></head><body>
<div class="announcement-bar">Brand X free shipping</div>
<header class="site-header sticky"><a class="logo logo--center" href="/"><img src="/logo.png" alt="Brand X"></a>
<nav><a href="/a">Shop</a><a href="/b">Sale</a><a href="/c">About</a><a href="/d">Blog</a></nav><button aria-label="search">Search</button></header>
<section class="shopify-section slideshow"><h1>Brand X summer slogan</h1><img src="/hero.jpg"></section>
<section class="collection-list"><img src="/1.jpg"><img src="/2.jpg"></section>
<section class="featured-collection product-grid"></section>
<section class="image-with-text"></section>
<section class="testimonials"></section>
<section class="newsletter"><form></form></section>
</body></html>`;

describe("theme builder: reference extraction", () => {
  it("summarises colours, fonts, header and section order without page text, logos or image URLs", () => {
    const s = summarizeReference(PAGE, ".x{color:#c9a227} h1{font-family:'Bodoni Moda', serif}", "https://brandx.example.com/");
    expect(s.themeColor).toBe("#0f3d2e");
    expect(s.colors.map((c) => c.hex)).toContain("#c9a227");
    expect(s.colors.map((c) => c.hex)).not.toContain("#ff0000"); // inside <script>
    expect(s.fonts).toEqual(expect.arrayContaining(["Cormorant Garamond", "Jost", "Bodoni Moda"]));
    expect(s.fontKeys).toEqual(expect.arrayContaining(["editorial-serif", "geometric-sans", "didone"]));
    expect(s.header).toMatchObject({ navLinks: 4, logoPosition: "center", sticky: true, hasSearch: true, hasAnnouncement: true });
    expect(s.sections).toEqual(["announcement", "hero", "category tiles", "product grid", "image + text story", "testimonials", "newsletter"]);
    expect(s.hints).toMatchObject({ pillButtons: true, uppercaseHeadings: true, darkBackground: true });
    const json = JSON.stringify(s);
    for (const leaked of ["Brand X", "slogan", "logo.png", "hero.jpg", "free shipping"]) expect(json).not.toContain(leaked);
  });

  it("only follows same-site stylesheets", () => {
    expect(stylesheetLinks(PAGE, "https://brandx.example.com/")).toEqual(["https://brandx.example.com/assets/theme.css"]);
  });

  it("ignores emoji, icon and OS fallback fonts", () => {
    const s = summarizeReference("<html><body></body></html>", "a{font-family:\"Noto Color Emoji\")} b{font-family:SFMono-Regular,monospace} c{font-family:'Self Modern',serif} i{font-family:FontAwesome}", "https://x.example.com/");
    expect(s.fonts).toEqual(["Self Modern"]);
  });

  it("maps fonts to the allowed stacks and merges near-identical colours", () => {
    expect(mapFontToKey("Montserrat")).toBe("geometric-sans");
    expect(mapFontToKey("Playfair Display")).toBe("playfair");
    expect(mapFontToKey("Wingdings")).toBeNull();
    expect(extractColors("a{color:#111111} b{color:#121212} c{color:rgba(0,0,0,0.1)} d{color:rgb(255,0,0)}").map((c) => c.hex)).toEqual(["#111111", "#ff0000"]);
  });
});
