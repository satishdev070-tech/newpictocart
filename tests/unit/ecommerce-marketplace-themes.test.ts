import { describe, expect, it } from "vitest";
import { ecommerceMarketplaceThemes, MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { themeSiteType } from "@/features/theme/marketplace/types";

describe("ecommerceMarketplaceThemes", () => {
  it("excludes informative themes from the full catalogue", () => {
    const filtered = ecommerceMarketplaceThemes();
    expect(filtered.length).toBeLessThan(MARKETPLACE_THEMES.length);
    expect(filtered.every((t) => themeSiteType(t) !== "informative")).toBe(true);
    expect(MARKETPLACE_THEMES.some((t) => themeSiteType(t) === "informative")).toBe(true);
  });

  it("keeps every ecommerce theme (including legacy without siteType)", () => {
    const filtered = ecommerceMarketplaceThemes();
    const ecommerce = MARKETPLACE_THEMES.filter((t) => themeSiteType(t) === "ecommerce");
    expect(filtered.map((t) => t.key)).toEqual(ecommerce.map((t) => t.key));
  });

  it("filters an arbitrary list (seller registry / custom themes)", () => {
    const sample = [
      MARKETPLACE_THEMES.find((t) => themeSiteType(t) === "informative")!,
      MARKETPLACE_THEMES.find((t) => themeSiteType(t) === "ecommerce")!,
    ];
    expect(ecommerceMarketplaceThemes(sample)).toHaveLength(1);
    expect(themeSiteType(ecommerceMarketplaceThemes(sample)[0]!)).toBe("ecommerce");
  });
});
