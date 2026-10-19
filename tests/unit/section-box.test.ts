import { describe, expect, it } from "vitest";
import { mobileSpace, normalizeSectionBox, parseSectionBox, sectionBoxVars } from "@/features/theme/schema/section-box";

describe("section size and spacing envelope", () => {
  it("keeps a compact, validated set of overrides", () => {
    expect(
      normalizeSectionBox({ scale: 100, width: "wide", paddingTop: 80, paddingBottom: undefined, mobile: { paddingTop: 44 } }),
    ).toEqual({ width: "wide", paddingTop: 80, mobile: { paddingTop: 44 } });
  });

  it("derives unset phone spacing from desktop and emits only safe CSS variables", () => {
    const box = { scale: 115, width: "narrow" as const, marginTop: 100, paddingBottom: 48 };
    expect(mobileSpace(box, "marginTop")).toBe(60);
    expect(sectionBoxVars(box)).toEqual({
      vars: {
        "--sf-scale": "1.15",
        "--sf-container": "1080px",
        "--sf-mt": "100px",
        "--sf-mt-m": "60px",
        "--sf-pb": "48px",
        "--sf-pb-m": "29px",
      },
      attrs: { "data-sf-scale": "", "data-sf-width": "narrow", "data-sf-mt": "", "data-sf-pb": "" },
    });
  });

  it("rejects malformed values without preventing the rest of a section from rendering", () => {
    expect(parseSectionBox({ scale: 117 }).error).toBeTruthy();
    expect(parseSectionBox({ paddingTop: 161 }).error).toBeTruthy();
    expect(parseSectionBox({ width: "javascript" }).error).toBeTruthy();
  });
});
