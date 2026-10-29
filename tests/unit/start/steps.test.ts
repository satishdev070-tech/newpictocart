import { describe, expect, it } from "vitest";
import {
  START_STEP_IDS,
  isStartStepId,
  startSearchQuery,
  startStepPath,
} from "@/features/start/steps";

describe("start steps", () => {
  it("lists journey mounts and rejects legacy ids", () => {
    expect(START_STEP_IDS).toEqual([
      "lang",
      "path",
      "quiz",
      "voice",
      "business",
      "theme",
      "account",
      "building",
      "done",
    ]);
    expect(isStartStepId("lang")).toBe(true);
    expect(isStartStepId("quiz")).toBe(true);
    expect(isStartStepId("welcome")).toBe(false);
    expect(isStartStepId("intent")).toBe(false);
    expect(isStartStepId("products")).toBe(false);
    expect(isStartStepId("mood")).toBe(false);
    expect(isStartStepId("payment")).toBe(false);
    expect(isStartStepId("nope")).toBe(false);
  });

  it("builds /start/[step] paths", () => {
    expect(startStepPath("lang")).toBe("/start/lang");
    expect(startStepPath("theme")).toBe("/start/theme");
  });

  it("serializes search params for redirects", () => {
    expect(startSearchQuery({ plan: "pro", theme: "aangan" })).toBe("plan=pro&theme=aangan");
    expect(startSearchQuery({ resume: "1", empty: "" })).toBe("resume=1");
    expect(startSearchQuery({})).toBe("");
  });
});
