import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { resolveFooterSectionRef } from "@/features/theme/site-builder/footer-ref";
import type { SectionInstance } from "@/features/theme/sections/types";

describe("resolveFooterSectionRef", () => {
  it("resolves the Footer section in layout.footer (default theme)", () => {
    const ref = resolveFooterSectionRef(DEFAULT_THEME_CONFIG);
    expect(ref).toEqual({ list: "layout.footer", sectionId: "footer" });
  });

  it("prefers type === Footer over earlier non-Footer items", () => {
    const extra: SectionInstance = {
      id: "announcement-footer",
      type: "AnnouncementBar",
      settings: {},
      visibility: { desktop: true, mobile: true },
    };
    const footer: SectionInstance = {
      id: "real-footer",
      type: "Footer",
      settings: {},
      visibility: { desktop: true, mobile: true },
    };
    const ref = resolveFooterSectionRef({
      layout: { ...DEFAULT_THEME_CONFIG.layout, footer: [extra, footer] },
    });
    expect(ref).toEqual({ list: "layout.footer", sectionId: "real-footer" });
  });

  it("falls back to the first layout.footer item when none is type Footer", () => {
    const only: SectionInstance = {
      id: "orphan",
      type: "RichText",
      settings: {},
      visibility: { desktop: true, mobile: true },
    };
    const ref = resolveFooterSectionRef({
      layout: { ...DEFAULT_THEME_CONFIG.layout, footer: [only] },
    });
    expect(ref).toEqual({ list: "layout.footer", sectionId: "orphan" });
  });

  it("returns null when layout.footer is empty", () => {
    expect(
      resolveFooterSectionRef({
        layout: { ...DEFAULT_THEME_CONFIG.layout, footer: [] },
      }),
    ).toBeNull();
  });
});
