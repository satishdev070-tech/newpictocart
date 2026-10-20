import { describe, expect, it } from "vitest";
import { backTarget, progressFor } from "@/features/start/flow";
import { emptyStartDraft } from "@/features/start/draft/schema";

describe("start flow progress", () => {
  it("labels language step", () => {
    expect(progressFor("lang", null, "en-IN").overall).toBe("Step 1 of 6");
    expect(progressFor("lang", null, "hi-IN").overall).toBe("चरण 1 / 6");
  });

  it("labels manual business and payment", () => {
    const d = emptyStartDraft();
    d.path = "manual";
    expect(progressFor("business", "manual", "en-IN")).toMatchObject({
      overall: "Step 4 of 8",
      manual: "Manual • Step 1 of 4",
    });
    expect(progressFor("payment", "manual", "hi-IN").overall).toBe("चरण 7 / 8");
    expect(progressFor("account", "manual", "en-IN").overall).toBe("Step 8 of 8");
  });

  it("labels AI voice and account", () => {
    expect(progressFor("voice", "ai", "en-IN").overall).toBe("Step 5 of 6");
    expect(progressFor("account", "ai", "en-IN").overall).toBe("Step 6 of 6");
  });

  it("hides progress on welcome", () => {
    expect(progressFor("welcome", null, "en-IN").overall).toBeNull();
  });

  it("treats the quiz as the AI step and returns to it from building", () => {
    expect(progressFor("quiz", "ai", "en-IN").overall).toBe("Step 5 of 6");
    expect(progressFor("quiz", "ai", "hi-IN").overall).toBe("चरण 5 / 6");
    expect(backTarget("quiz", "ai", "quiz")).toBe("voice");
    expect(backTarget("building", "ai", "quiz")).toBe("quiz");
    expect(backTarget("building", "ai", "talk")).toBe("voice");
    expect(backTarget("building", "manual")).toBe("payment");
  });
});
