import { describe, expect, it } from "vitest";
import {
  backTarget,
  businessComplete,
  draftHasProgress,
  draftReadyToFinalize,
  nextScreenAfterLang,
  nextScreenAfterPath,
  progressFor,
  voiceFactsComplete,
} from "@/features/start/flow";
import { emptyStartDraft } from "@/features/start/draft/schema";

describe("start flow progress", () => {
  it("numbers the online-store journey with the build step (6 steps)", () => {
    const o = { buildStep: true };
    expect(progressFor("lang", o)).toEqual({ step: 1, total: 6 });
    expect(progressFor("build", o)).toEqual({ step: 2, total: 6 });
    expect(progressFor("path", o)).toEqual({ step: 3, total: 6 });
    expect(progressFor("quiz", o)).toEqual({ step: 4, total: 6 });
    expect(progressFor("voice", o)).toEqual({ step: 4, total: 6 });
    expect(progressFor("theme", o)).toEqual({ step: 5, total: 6 });
    expect(progressFor("account", o)).toEqual({ step: 6, total: 6 });
  });

  it("skips the build step when the informative gate is off (5 steps)", () => {
    const o = { buildStep: false };
    expect(progressFor("lang", o)).toEqual({ step: 1, total: 5 });
    expect(progressFor("path", o)).toEqual({ step: 2, total: 5 });
    expect(progressFor("quiz", o)).toEqual({ step: 3, total: 5 });
    expect(progressFor("account", o)).toEqual({ step: 5, total: 5 });
  });

  it("hides progress on building and done; maps legacy screens", () => {
    expect(progressFor("building", { buildStep: true })).toBeNull();
    expect(progressFor("done", { buildStep: true })).toBeNull();
    expect(progressFor("intent", { buildStep: false })).toEqual({ step: 2, total: 5 });
    expect(progressFor("mood", { buildStep: false })).toEqual({ step: 4, total: 5 });
    expect(progressFor("business", { buildStep: false })).toEqual({ step: 3, total: 5 });
  });
});

describe("start flow order", () => {
  it("goes lang → build when the build step exists, else lang → path", () => {
    expect(nextScreenAfterLang(true)).toBe("build");
    expect(nextScreenAfterLang(false)).toBe("path");
  });

  it("backs path → build → lang with the build step", () => {
    expect(backTarget("path", "ai", "quiz", true)).toBe("build");
    expect(backTarget("build", null, undefined, true)).toBe("lang");
    expect(backTarget("path", "ai", "quiz", false)).toBe("lang");
  });
});

describe("start flow graph", () => {
  it("routes path → voice/quiz for AI modes and legacy manual → quiz", () => {
    expect(nextScreenAfterPath("ai")).toBe("voice");
    expect(nextScreenAfterPath("ai", "talk")).toBe("voice");
    expect(nextScreenAfterPath("ai", "quiz")).toBe("quiz");
    expect(nextScreenAfterPath("manual")).toBe("quiz");
  });

  it("backs through the graph", () => {
    expect(backTarget("lang", null)).toBeNull();
    expect(backTarget("path", null)).toBe("lang");
    expect(backTarget("business", "manual")).toBe("path");
    expect(backTarget("voice", "ai")).toBe("path");
    expect(backTarget("quiz", "ai", "quiz")).toBe("path");
    expect(backTarget("theme", "manual")).toBe("quiz");
    expect(backTarget("theme", "ai", "talk")).toBe("voice");
    expect(backTarget("theme", "ai", "quiz")).toBe("quiz");
    expect(backTarget("account", "ai")).toBe("theme");
    expect(backTarget("building", "ai")).toBe("account");
    expect(backTarget("done", "manual")).toBeNull();
  });
});

describe("start flow completeness", () => {
  it("requires name, category, and subcategory for business", () => {
    const d = emptyStartDraft();
    d.path = "manual";
    expect(businessComplete(d)).toBe(false);
    d.business.name = "Meera";
    d.business.category = "fashion";
    expect(businessComplete(d)).toBe(false);
    d.business.subcategory = "ethnic";
    expect(businessComplete(d)).toBe(true);
    expect(draftReadyToFinalize(d)).toBe(true);
  });

  it("accepts multi-select categories + custom product types", () => {
    const d = emptyStartDraft();
    d.path = "ai";
    d.business.name = "Meera";
    d.business.categories = ["jewellery", "fashion"];
    expect(businessComplete(d)).toBe(false);
    d.business.subcategories = ["Temple pieces"];
    expect(businessComplete(d)).toBe(true);
    expect(draftReadyToFinalize(d)).toBe(true);
  });

  it("treats voice facts as complete without siteMode", () => {
    const d = emptyStartDraft();
    d.path = "ai";
    d.voice.facts = {
      ...d.voice.facts,
      name: "Kia",
      category: "fashion",
      subcategory: "western",
      siteMode: null,
    };
    expect(voiceFactsComplete(d)).toBe(true);
    expect(draftReadyToFinalize(d)).toBe(true);
  });

  it("treats lang with no fields as no progress", () => {
    const d = emptyStartDraft();
    expect(d.screen).toBe("lang");
    expect(draftHasProgress(d)).toBe(false);
    d.business.name = "A";
    expect(draftHasProgress(d)).toBe(true);
  });

  it("does not treat empty deep-link screens as progress", () => {
    const d = emptyStartDraft();
    d.screen = "theme";
    expect(draftHasProgress(d)).toBe(false);
    d.screen = "quiz";
    expect(draftHasProgress(d)).toBe(false);
    d.path = "ai";
    expect(draftHasProgress(d)).toBe(true);
  });
});
