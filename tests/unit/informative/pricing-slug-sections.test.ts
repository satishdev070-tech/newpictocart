import { describe, expect, it } from "vitest";
import { formatDuration, formatServicePrice, priceTypeNeedsAmount } from "@/features/informative/pricing";
import { RESERVED_PAGE_SLUGS, slugify, uniqueSlug } from "@/features/informative/slug";
import { parseStoredSections, sectionsSchema, SYSTEM_PAGES } from "@/features/informative/sections";
import { INFO_CATEGORIES, infoCategoryLabel, isInfoCategory } from "@/features/informative/categories";

describe("price display", () => {
  it("formats by price type from integer paise", () => {
    expect(formatServicePrice("FIXED", 150000)).toBe("₹1,500");
    expect(formatServicePrice("STARTING_FROM", 99950)).toBe("From ₹999.50");
    expect(formatServicePrice("ON_REQUEST", 150000)).toBe("Price on request");
    expect(formatServicePrice("HIDDEN", 150000)).toBeNull();
    expect(formatServicePrice("FIXED", null)).toBe("Price on request");
    expect(priceTypeNeedsAmount("FIXED")).toBe(true);
    expect(priceTypeNeedsAmount("ON_REQUEST")).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});

describe("slugs", () => {
  it("slugifies names like the DB check expects", () => {
    expect(slugify("  Hair Cut & Styling!! ")).toBe("hair-cut-and-styling");
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(200)).length).toBe(120);
  });

  it("makes slugs unique per site", () => {
    expect(uniqueSlug("Yoga", new Set())).toBe("yoga");
    expect(uniqueSlug("Yoga", new Set(["yoga"]))).toBe("yoga-2");
    expect(uniqueSlug("Yoga", new Set(["yoga", "yoga-2"]))).toBe("yoga-3");
    expect(uniqueSlug("!!!", new Set(), "service")).toBe("service");
    const long = "x".repeat(120);
    expect(uniqueSlug(long, new Set([long])).length).toBeLessThanOrEqual(120);
  });

  it("reserves the public site's own routes", () => {
    for (const s of ["about", "services", "gallery", "contact"]) expect(RESERVED_PAGE_SLUGS.has(s)).toBe(true);
  });
});

describe("page sections", () => {
  it("drops invalid and duplicate sections on read and sorts by order", () => {
    const parsed = parseStoredSections([
      { id: "b", type: "faq", props: {}, order: 2, visible: true },
      { id: "a", type: "hero", props: { headline: "Hi" }, order: 1 },
      { id: "x", type: "not-a-section", props: {}, order: 0 },
      { id: "a", type: "cta", props: {}, order: 3 },
      "junk",
    ]);
    expect(parsed.map((s) => s.id)).toEqual(["a", "b"]);
    expect(parsed[0]?.visible).toBe(true);
    expect(parseStoredSections(null)).toEqual([]);
  });

  it("rejects duplicate ids and oversized props on save", () => {
    expect(sectionsSchema.safeParse([{ id: "a", type: "hero", props: {}, order: 0 }, { id: "a", type: "faq", props: {}, order: 1 }]).success).toBe(false);
    expect(sectionsSchema.safeParse([{ id: "a", type: "hero", props: { t: "x".repeat(25_000) }, order: 0 }]).success).toBe(false);
    expect(sectionsSchema.safeParse([{ id: "a", type: "hero", props: {}, order: 0 }]).success).toBe(true);
  });

  it("defines the four system pages", () => {
    expect(SYSTEM_PAGES.map((p) => p.type)).toEqual(["HOME", "ABOUT", "SERVICES", "CONTACT"]);
  });
});

describe("categories", () => {
  it("has the nine plan categories", () => {
    expect(INFO_CATEGORIES).toHaveLength(9);
    expect(isInfoCategory("gym_fitness")).toBe(true);
    expect(isInfoCategory("wellness")).toBe(false);
    expect(infoCategoryLabel("salon_beauty")).toBe("Salon / Beauty");
    expect(infoCategoryLabel("nope")).toBe("Other");
  });

  it("matches the DB check constraint", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261111008100_informative_content.sql", "utf8");
    for (const c of INFO_CATEGORIES) expect(sql).toContain(`'${c.id}'`);
  });
});
