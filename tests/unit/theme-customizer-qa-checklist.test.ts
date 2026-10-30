import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  QA_PHASES,
  THEME_CUSTOMIZER_QA,
  checklistByPhase,
  checklistIds,
  type QaPhase,
} from "../../scripts/dev/theme-customizer-qa/checklist";

/**
 * Phase F + Master harness: checklist catalog integrity + unit files present.
 */

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("theme customizer QA checklist catalog", () => {
  it("covers phases A1–E and Master M0–M4 with unique stable IDs", () => {
    expect([...QA_PHASES]).toEqual(["A1", "A2", "B", "C", "D", "E", "M0", "M1", "M2", "M3", "M4"]);
    const ids = checklistIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const phase of QA_PHASES) {
      const items = checklistByPhase(phase);
      expect(items.length, `phase ${phase}`).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.id).toMatch(new RegExp(`^${phase}-\\d{2}$`));
        expect(item.phase).toBe(phase);
        expect(item.title.length).toBeGreaterThan(8);
      }
    }
  });

  it("documents the four E page templates and popup newsletter|form", () => {
    const e = checklistByPhase("E").map((i) => i.id);
    expect(e).toEqual(["E-01", "E-02", "E-03", "E-04", "E-05", "E-06"]);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-01")!.title).toMatch(/About/i);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-02")!.title).toMatch(/Contact/i);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-03")!.title).toMatch(/FAQ/i);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-04")!.title).toMatch(/Blog/i);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-05")!.title).toMatch(/newsletter/i);
    expect(THEME_CUSTOMIZER_QA.find((i) => i.id === "E-06")!.title).toMatch(/form/i);
  });

  it("documents Master M0–M4 acceptance rows", () => {
    expect(checklistByPhase("M0").map((i) => i.id)).toEqual(["M0-01", "M0-02", "M0-03", "M0-04"]);
    expect(checklistByPhase("M1").map((i) => i.id)).toEqual(["M1-01", "M1-02", "M1-03", "M1-04"]);
    expect(checklistByPhase("M2").map((i) => i.id)).toEqual(["M2-01", "M2-02", "M2-03"]);
    expect(checklistByPhase("M3").map((i) => i.id)).toEqual(["M3-01", "M3-02", "M3-03"]);
    expect(checklistByPhase("M4").map((i) => i.id)).toEqual(["M4-01", "M4-02", "M4-03", "M4-04"]);
  });

  it("marks A1 items as unit-covered and points at existing test files", () => {
    const a1 = checklistByPhase("A1");
    expect(a1.every((i) => i.coverage === "unit" || i.coverage === "unit+manual")).toBe(true);
    const files = new Set(a1.flatMap((i) => i.unitFiles ?? []));
    expect(files.has("tests/unit/hero-slide-visibility.test.ts")).toBe(true);
    expect(files.has("tests/unit/site-builder-sections.test.ts")).toBe(true);
    for (const rel of files) {
      expect(existsSync(resolve(ROOT, rel)), rel).toBe(true);
    }
  });

  it("Master unit-covered rows point at existing test files", () => {
    const master = THEME_CUSTOMIZER_QA.filter((i) => i.phase.startsWith("M"));
    const files = new Set(master.flatMap((i) => i.unitFiles ?? []));
    expect(files.has("tests/unit/theme-page-chrome.test.ts")).toBe(true);
    expect(files.has("tests/unit/site-builder-apply-page-template.test.ts")).toBe(true);
    for (const rel of files) {
      expect(existsSync(resolve(ROOT, rel)), rel).toBe(true);
    }
  });

  it("smoke catalog lists every checklist id", () => {
    const ids = checklistIds();
    expect(ids[0]).toBe("A1-01");
    expect(ids.at(-1)).toBe("M4-04");
    expect(ids.length).toBe(THEME_CUSTOMIZER_QA.length);
  });
});

describe("A1 shared helpers referenced by QA harness", () => {
  it("QA phase labels match master-scope letters", () => {
    const phases: QaPhase[] = ["A1", "A2", "B", "C", "D", "E", "M0", "M1", "M2", "M3", "M4"];
    expect(QA_PHASES).toEqual(phases);
  });
});
