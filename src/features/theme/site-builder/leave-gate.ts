/**
 * Pure helpers for the site builder exit / leave gate.
 * UI opens ExitUnsavedDialog when leave is gated; beforeunload stays armed while gated.
 */

export type LeaveGate = {
  dirty: boolean;
  /** Draft save (manual, autosave, or exit flush) in flight. */
  saving: boolean;
};

/** True when navigating away must prompt (or beforeunload must warn). */
export function shouldGateLeave({ dirty, saving }: LeaveGate): boolean {
  return dirty || saving;
}

export type LeaveDecision = "proceed" | "prompt";

/** Bypass is for deliberate leave after Save / Discard / conflict Reload. */
export function leaveDecision(gate: LeaveGate & { bypass?: boolean }): LeaveDecision {
  if (gate.bypass) return "proceed";
  return shouldGateLeave(gate) ? "prompt" : "proceed";
}

/**
 * After the merchant discards local unsynced edits, in-flight autosave must not call
 * `markSaved` with the discarded document. Generations must match.
 */
export function shouldAcceptDraftSave(activeGeneration: number, saveGeneration: number): boolean {
  return activeGeneration === saveGeneration;
}
