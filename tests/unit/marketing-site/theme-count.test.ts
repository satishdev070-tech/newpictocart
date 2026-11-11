import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MARKETPLACE_SHOP_THEME_COUNT } from "@/features/marketing-site/theme-count";
import { ecommerceMarketplaceThemes } from "@/features/theme/marketplace/catalog";

describe("marketing chrome theme count", () => {
  it("matches the catalog's shop theme count", () => {
    expect(MARKETPLACE_SHOP_THEME_COUNT).toBe(ecommerceMarketplaceThemes().length);
  });

  it("chrome-content stays off the theme catalog (always-loaded Worker graph)", () => {
    const src = readFileSync("src/features/marketing-site/chrome-content.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'](\.\/themes|@\/features\/theme\/marketplace\/)/);
  });
});
