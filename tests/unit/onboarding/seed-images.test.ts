import { describe, expect, it } from "vitest";
import { assignSeedPhotos, fillEmptyThemeImages, seedPhotoAlt, seedPhotoUrl } from "@/features/onboarding/seed/images";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { curatedStock } from "@/lib/unsplash-stock";

describe("assignSeedPhotos", () => {
  it("maps gourmet food, grocery organic, and home decor furniture", () => {
    expect(assignSeedPhotos("gourmet", { products: 1, categories: 1, collections: 1, blogs: 1 }).category).toBe("food");
    expect(assignSeedPhotos("grocery", { products: 1, categories: 1, collections: 1, blogs: 1 }).category).toBe("organic");
    expect(assignSeedPhotos("home-decor", { products: 1, categories: 1, collections: 1, blogs: 1 }).category).toBe("furniture");
  });

  it("cycles product photos so neighbouring products are not the same shot", () => {
    const pool = curatedStock("food", "products");
    const assigned = assignSeedPhotos("sweets", { products: pool.length + 1, categories: 5, collections: 2, blogs: 6 });
    expect(assigned.category).toBe("food");
    expect(assigned.products).toHaveLength(pool.length + 1);
    expect(assigned.products[0]!.id).not.toBe(assigned.products[1]!.id);
    expect(assigned.products[0]!.id).toBe(assigned.products[pool.length]!.id);
    expect(assigned.products.every((photo) => photo.slot === "products")).toBe(true);
    expect(assigned.categories.every((photo) => photo.slot === "tiles")).toBe(true);
    expect(assigned.hero?.slot).toBe("hero");
    expect(assigned.blogs[0]?.slot).toBe("hero");
    expect(assigned.blogs.some((photo) => photo.slot === "story")).toBe(true);
  });

  it("builds a credited Unsplash JPEG url without calling the network", () => {
    const assigned = assignSeedPhotos("fashion", { products: 2, categories: 1, collections: 1, blogs: 1 });
    const photo = assigned.products[0]!;
    const url = seedPhotoUrl(photo);
    expect(url.startsWith("https://images.unsplash.com/")).toBe(true);
    expect(url).toContain("w=1200");
    expect(seedPhotoAlt(photo)).toContain(`Photo: ${photo.photographer?.name} / Unsplash`);
  });

  it("fills an empty homepage photo and leaves one the seller already chose", () => {
    const config = {
      templates: {
        home: [
          { type: "Hero", settings: { slides: [{ imagePath: "" }] } },
          { type: "CategoryGrid", settings: { items: [{ id: "c1", imagePath: "tenant/already" }] } },
        ],
      },
    } as unknown as ThemeConfig;
    const filled = fillEmptyThemeImages(config, {
      hero: "tenant/hero.jpg",
      categoryById: { c1: "tenant/new.jpg" },
      collectionById: {},
      attached: true,
    });
    expect(filled.changed).toBe(true);
    const hero = filled.config.templates.home[0]!.settings as { slides: { imagePath: string }[] };
    expect(hero.slides[0]!.imagePath).toBe("tenant/hero.jpg");
    const grid = filled.config.templates.home[1]!.settings as { items: { imagePath: string }[] };
    expect(grid.items[0]!.imagePath).toBe("tenant/already");
  });
});
