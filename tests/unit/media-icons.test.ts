import { describe, expect, it } from "vitest";
import { imagePath } from "@/features/theme/schema/primitives";
import { collectAssetPaths } from "@/features/theme/schema/config";
import { assetUrl } from "@/lib/storage/assets";
import { ICON_CATEGORIES, ICON_NAMES, iconValue, isIconName, parseIconValue } from "@/lib/icons/names";
import { ICON_COMPONENTS } from "@/lib/icons/registry";

const PATH = "tenant/0b9d6c1e-2f3a-4b5c-8d7e-9f0a1b2c3d4e/theme/hero.webp";

describe("icon registry", () => {
  it("has a large set of unique, kebab-case names", () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(150);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    for (const n of ICON_NAMES) expect(n).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("has unique category ids and a component for every name", () => {
    expect(new Set(ICON_CATEGORIES.map((c) => c.id)).size).toBe(ICON_CATEGORIES.length);
    expect(Object.keys(ICON_COMPONENTS).sort()).toEqual([...ICON_NAMES].sort());
    for (const n of ICON_NAMES) expect(ICON_COMPONENTS[n]).toBeTruthy();
  });
});

describe("imagePath with icon values", () => {
  it("accepts empty, storage paths and allowlisted icons", () => {
    expect(imagePath.parse("")).toBe("");
    expect(imagePath.parse(PATH)).toBe(PATH);
    expect(imagePath.parse("icon:truck")).toBe("icon:truck");
    expect(imagePath.parse("  icon:shopping-cart ")).toBe("icon:shopping-cart");
    for (const n of ICON_NAMES) expect(imagePath.safeParse(iconValue(n)).success).toBe(true);
  });

  it("rejects unknown or unsafe icon values", () => {
    for (const v of [
      "icon:",
      "icon:not-a-real-icon",
      "icon:Truck",
      "icon:truck/../x",
      "icon:<svg onload=alert(1)>",
      "icon:truck\"><script>",
      "icon:-truck",
      "icon:truck--x",
      "icon::truck",
      "ICON:truck",
      "icons:truck",
      "truck",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "https://example.com/a.png",
      `icon:${"a".repeat(80)}`,
      "icon:constructor",
      "icon:__proto__",
    ]) {
      expect(imagePath.safeParse(v).success, v).toBe(false);
    }
  });

  it("parseIconValue only returns allowlisted names", () => {
    expect(parseIconValue("icon:gift")).toBe("gift");
    expect(parseIconValue("icon:toString")).toBeNull();
    expect(parseIconValue(PATH)).toBeNull();
    expect(parseIconValue(null)).toBeNull();
    expect(isIconName("hasOwnProperty")).toBe(false);
  });

  it("icon values are not storage paths", () => {
    expect(assetUrl("icon:truck")).toBeNull();
    expect(collectAssetPaths({ a: "icon:truck", b: [PATH, "icon:gift"] })).toEqual([PATH]);
  });
});
