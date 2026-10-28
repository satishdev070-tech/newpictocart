import { describe, expect, it } from "vitest";
import {
  flattenStartThemeOptions,
  selectStartThemeOptions,
  START_THEME_ALTERNATIVE_COUNT,
} from "@/features/start/theme-options";

const ranked = [
  { key: "a", name: "Alpha", industry: "fashion" },
  { key: "b", name: "Beta", industry: "fashion" },
  { key: "c", name: "Gamma", industry: "fashion" },
  { key: "d", name: "Delta", industry: "handicrafts" },
  { key: "e", name: "Epsilon", industry: "general" },
  { key: "f", name: "Zeta", industry: "general" },
];

describe("selectStartThemeOptions", () => {
  it("recommends the first ranked theme when no preference", () => {
    const result = selectStartThemeOptions(ranked, null);
    expect(result.recommended.key).toBe("a");
    expect(result.alternatives.map((t) => t.key)).toEqual(["b", "c", "d", "e"]);
    expect(result.alternatives).toHaveLength(START_THEME_ALTERNATIVE_COUNT);
  });

  it("uses preferred as recommended and keeps best-fit first in alternatives", () => {
    const preferred = ranked[3]!;
    const result = selectStartThemeOptions(ranked, preferred, (key) => (key === "a" ? "/shot-a.webp" : null));
    expect(result.recommended).toEqual({
      key: "d",
      name: "Delta",
      industry: "handicrafts",
    });
    expect(result.alternatives[0]).toEqual({
      key: "a",
      name: "Alpha",
      industry: "fashion",
      thumbnail: "/shot-a.webp",
    });
    expect(result.alternatives.map((t) => t.key)).not.toContain("d");
    expect(result.alternatives).toHaveLength(START_THEME_ALTERNATIVE_COUNT);
  });

  it("flattens without duplicates", () => {
    const result = selectStartThemeOptions(ranked, ranked[0]!);
    expect(flattenStartThemeOptions(result).map((t) => t.key)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
