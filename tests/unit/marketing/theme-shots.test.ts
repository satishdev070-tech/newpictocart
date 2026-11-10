import { describe, expect, it } from "vitest";
import { themeShot } from "@/features/marketing-site/theme-shots";

describe("themeShot", () => {
  it("returns the same-origin WebP for captured contemporary-ethnic desktop", () => {
    expect(themeShot("contemporary-ethnic", "desktop")).toBe("/theme-previews/contemporary-ethnic-desktop.webp");
    expect(themeShot("contemporary-ethnic", "phone")).toBe("/theme-previews/contemporary-ethnic-phone.webp");
  });

  it("returns null for themes without a capture", () => {
    expect(themeShot("no-such-theme", "desktop")).toBeNull();
  });
});
