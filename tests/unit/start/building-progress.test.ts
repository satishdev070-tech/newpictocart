import { describe, expect, it } from "vitest";
import {
  BUILDING_PROGRESS_MS,
  BUILDING_SOFT_CAP,
  BUILDING_STEP_MS,
  buildingProgressPct,
  buildingStepIndex,
} from "@/features/start/screens/building-screen";
import { startCopy } from "@/features/start/copy";

describe("building screen progress helpers", () => {
  it("caps progress while waiting for finalize", () => {
    expect(buildingProgressPct(BUILDING_PROGRESS_MS, true)).toBe(BUILDING_SOFT_CAP);
    expect(buildingProgressPct(BUILDING_PROGRESS_MS * 2, true)).toBe(BUILDING_SOFT_CAP);
    expect(buildingProgressPct(BUILDING_PROGRESS_MS, false)).toBe(100);
  });

  it("sequences steps through theme → categories → products → blogs → reviews → ready", () => {
    const steps = startCopy("en-IN").building.steps;
    expect(steps).toEqual([
      "Applying your theme…",
      "Setting up categories…",
      "Adding sample products…",
      "Writing blog posts…",
      "Collecting sample reviews…",
      "Your store is ready!",
    ]);
    expect(buildingStepIndex(0, steps.length)).toBe(0);
    expect(buildingStepIndex(BUILDING_STEP_MS * 2, steps.length)).toBe(2);
    expect(buildingStepIndex(BUILDING_STEP_MS * 99, steps.length)).toBe(steps.length - 1);
  });

  it("keeps quiz subcategory copy keys for EN", () => {
    const quiz = startCopy("en-IN").quiz;
    expect(quiz.subcategoryTitle).toBe("Select Products Category For Your Store?");
    expect(quiz.customSubHint).toBe("Add more type of products.");
  });
});
