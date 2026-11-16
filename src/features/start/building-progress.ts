/** Pure timing helpers for the building screen (kept free of UI imports for unit tests). */

/** Soft progress ceiling while signed-in finalize is in flight. */
export const BUILDING_SOFT_CAP = 92;
/** Wall-clock ms to reach softCap (unsigned journeys continue to 100%). */
export const BUILDING_PROGRESS_MS = 4200;
/** Delay between sequenced status messages. */
export const BUILDING_STEP_MS = 700;

/** Map elapsed ms → percent, capped while waiting on finalize. */
export function buildingProgressPct(elapsedMs: number, waitForFinalize: boolean): number {
  const softCap = waitForFinalize ? BUILDING_SOFT_CAP : 100;
  return Math.min(softCap, Math.round((elapsedMs / BUILDING_PROGRESS_MS) * softCap));
}

/** Active step index for the sequenced building messages. */
export function buildingStepIndex(elapsedMs: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(stepCount - 1, Math.floor(elapsedMs / BUILDING_STEP_MS));
}
