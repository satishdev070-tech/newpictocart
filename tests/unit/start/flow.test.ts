import { describe, expect, it } from "vitest";
import {
  backTarget,
  businessComplete,
  draftHasProgress,
  draftReadyToFinalize,
  nextScreenAfterPath,
  progressFor,
  voiceFactsComplete,
} from "@/features/start/flow";
import { emptyStartDraft } from "@/features/start/draft/schema";

describe("start flow progress", () => {
  it("labels five-screen steps", () => {
    expect(progressFor("lang", null, "en-IN").overall).toBe("Step 1 of 5");
    expect(progressFor("lang", null, "hi-IN").overall).toBe("चरण 1 / 5");
    expect(progressFor("path", null, "en-IN")).toMatchObject({ overall: "Step 2 of 5", percent: 40 });
    expect(progressFor("business", "manual", "en-IN")).toMatchObject({
      overall: "Step 3 of 5",
      manual: null,
      percent: 60,
    });
    expect(progressFor("voice", "ai", "en-IN").overall).toBe("Step 3 of 5");
    expect(progressFor("quiz", "ai", "en-IN").overall).toBe("Step 3 of 5");
    expect(progressFor("theme", "manual", "en-IN").overall).toBe("Step 4 of 5");
    expect(progressFor("account", "ai", "en-IN").overall).toBe("Step 5 of 5");
  });

  it("hides progress on welcome, building, and done", () => {
    expect(progressFor("welcome", null, "en-IN").overall).toBeNull();
    expect(progressFor("building", "ai", "en-IN").overall).toBeNull();
    expect(progressFor("done", "manual", "en-IN").overall).toBeNull();
  });

  it("maps legacy content screens onto theme/business progress", () => {
    expect(progressFor("intent", null, "en-IN").overall).toBe("Step 2 of 5");
    expect(progressFor("mood", "manual", "en-IN").overall).toBe("Step 4 of 5");
    expect(progressFor("payment", "manual", "en-IN").overall).toBe("Step 4 of 5");
  });
});

describe("start flow graph", () => {
  it("routes path → voice/quiz for AI modes and path → business for manual", () => {
    expect(nextScreenAfterPath("ai")).toBe("voice");
    expect(nextScreenAfterPath("ai", "talk")).toBe("voice");
    expect(nextScreenAfterPath("ai", "quiz")).toBe("quiz");
    expect(nextScreenAfterPath("manual")).toBe("business");
  });

  it("backs through the five-screen graph", () => {
    expect(backTarget("lang", null)).toBeNull();
    expect(backTarget("path", null)).toBe("lang");
    expect(backTarget("business", "manual")).toBe("path");
    expect(backTarget("voice", "ai")).toBe("path");
    expect(backTarget("quiz", "ai", "quiz")).toBe("path");
    expect(backTarget("theme", "manual")).toBe("business");
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
});
