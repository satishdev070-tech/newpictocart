import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition } from "@/features/theme/sections/types";
import { EDGE, TOOLBAR_INSET, centeredLeft, headerFloor, menuOpensUp, toolbarTop } from "@/features/theme/site-builder/canvas/chrome-layout";
import { humanizeType, sectionChipLabel, sectionChipLabels } from "@/features/theme/site-builder/chip-labels";
import { parseHostMessage, HOST_TAG } from "@/features/theme/site-builder/protocol";

const VH = 800;
const H = 32;

describe("toolbarTop", () => {
  it("sits inside the section near its top", () => {
    expect(toolbarTop({ box: { top: 100, left: 0, width: 1000, height: 400 }, toolbarHeight: H, viewportHeight: VH })).toBe(100 + TOOLBAR_INSET);
  });

  it("stays below a visible store header while the section scrolls under it", () => {
    const top = toolbarTop({ box: { top: -200, left: 0, width: 1000, height: 900 }, toolbarHeight: H, viewportHeight: VH, minTop: 72 });
    expect(top).toBe(72 + EDGE);
  });

  it("sticks to the viewport top while the section scrolls, then moves below it", () => {
    expect(toolbarTop({ box: { top: -300, left: 0, width: 1000, height: 400 }, toolbarHeight: H, viewportHeight: VH })).toBe(EDGE);
    expect(toolbarTop({ box: { top: -370, left: 0, width: 1000, height: 400 }, toolbarHeight: H, viewportHeight: VH })).toBe(30 + EDGE);
  });

  it("flips below the header itself instead of covering it", () => {
    const top = toolbarTop({ box: { top: 0, left: 0, width: 1000, height: 72 }, toolbarHeight: H, viewportHeight: VH, inHeader: true });
    expect(top).toBe(72 + EDGE);
  });

  it("goes below (or above) a section too short to hold it", () => {
    expect(toolbarTop({ box: { top: 200, left: 0, width: 1000, height: 40 }, toolbarHeight: H, viewportHeight: VH })).toBe(240 + EDGE);
    expect(toolbarTop({ box: { top: 740, left: 0, width: 1000, height: 40 }, toolbarHeight: H, viewportHeight: VH })).toBe(740 - H - EDGE);
  });

  it("never leaves the viewport", () => {
    const top = toolbarTop({ box: { top: 780, left: 0, width: 1000, height: 600 }, toolbarHeight: H, viewportHeight: VH });
    expect(top).toBeLessThanOrEqual(VH - H - EDGE);
    expect(top).toBeGreaterThanOrEqual(EDGE);
  });
});

describe("chrome helpers", () => {
  it("centres within the viewport", () => {
    expect(centeredLeft({ top: 0, left: 0, width: 1000, height: 10 }, 200, 1000)).toBe(400);
    expect(centeredLeft({ top: 0, left: 0, width: 100, height: 10 }, 300, 390)).toBe(EDGE);
    expect(centeredLeft({ top: 0, left: 300, width: 90, height: 10 }, 300, 390)).toBe(390 - 300 - EDGE);
  });

  it("header floor only counts a header on screen at the top", () => {
    expect(headerFloor(null)).toBe(0);
    expect(headerFloor({ top: 0, left: 0, width: 10, height: 64 })).toBe(64);
    expect(headerFloor({ top: -100, left: 0, width: 10, height: 64 })).toBe(0);
    expect(headerFloor({ top: 300, left: 0, width: 10, height: 64 })).toBe(0);
  });

  it("opens the menu upwards near the viewport bottom", () => {
    expect(menuOpensUp(100, H, 130, VH)).toBe(false);
    expect(menuOpensUp(700, H, 130, VH)).toBe(true);
  });
});

describe("chip labels", () => {
  it("humanizes types", () => {
    expect(humanizeType("HeroSlideshow")).toBe("Hero slideshow");
    expect(humanizeType("")).toBe("Section");
  });

  it("adds the chosen layout variant", () => {
    const def = Object.values(SECTION_DEFINITIONS as Record<string, SectionDefinition>).find((d) =>
      d.fields.some((f) => f.kind === "select" && f.display === "variants" && f.options.length > 1),
    )!;
    const field = def.fields.find((f): f is Extract<EditorField, { kind: "select" }> => f.kind === "select" && f.display === "variants")!;
    const opt = field.options[1]!;
    expect(sectionChipLabel({ type: def.type, settings: { [field.key]: opt.value } } as never)).toBe(`${def.label} / ${opt.label}`);
  });

  it("labels every section of the document", () => {
    const labels = sectionChipLabels(DEFAULT_THEME_CONFIG);
    const ids = [...DEFAULT_THEME_CONFIG.layout.header, ...DEFAULT_THEME_CONFIG.templates.home].map((s) => s.id);
    for (const id of ids) expect(labels[id]).toBeTruthy();
  });

  it("parses the labels message defensively", () => {
    const msg = parseHostMessage({ tag: HOST_TAG, type: "labels", labels: { "hero-1": "Hero", "BAD ID": "x", "faq-12": 5 } });
    expect(msg).toEqual({ tag: HOST_TAG, type: "labels", labels: { "hero-1": "Hero" } });
    expect(parseHostMessage({ tag: HOST_TAG, type: "labels", labels: [] })).toBeNull();
  });
});
