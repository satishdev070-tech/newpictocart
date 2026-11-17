import { FINALIZE_PHASES, type FinalizePhase, type FinalizeProgress } from "./finalize-phases";

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


/**
 * Building step list index for the phase now running (steps: theme, categories, products, blogs,
 * reviews/photos, ready). `done` lights the last ("Your store is ready!") step.
 */
const PHASE_STEP: Record<FinalizePhase, number> = {
  store: 0,
  theme: 0,
  plan: 1,
  categories: 1,
  products: 2,
  navigation: 2,
  content: 3,
  images: 4,
  publishTheme: 4,
  finish: 4,
};

export function phaseStepIndex(phase: FinalizePhase, stepCount: number, done = false): number {
  if (stepCount <= 0) return 0;
  if (done) return stepCount - 1;
  return Math.min(Math.max(0, stepCount - 2), PHASE_STEP[phase]);
}

/** Real progress (0–100) from the phase reached; the image loop moves the bar inside its phase. */
export function phaseProgressPct(progress: Pick<FinalizeProgress, "phase" | "imagesTotal" | "imagesRemaining">, done = false): number {
  if (done) return 100;
  const i = FINALIZE_PHASES.indexOf(progress.phase);
  let within = 0;
  if (progress.phase === "images" && progress.imagesTotal > 0 && progress.imagesRemaining !== null) {
    within = Math.max(0, Math.min(1, (progress.imagesTotal - progress.imagesRemaining) / progress.imagesTotal));
  }
  const pct = Math.round(((i + within) / FINALIZE_PHASES.length) * 100);
  return Math.max(2, Math.min(97, pct));
}
