/**
 * Pure helpers for the site builder's local-first save loop:
 * edit → canvas paints from local history → debounced Save draft → explicit Publish.
 * Persistence never blocks `apply()`; these helpers only decide when / how to schedule it.
 */

/** Idle delay before an automatic draft save (ms). Manual Save remains immediate. */
export const AUTOSAVE_IDLE_MS = 2500;

export type AutosaveGate = {
  dirty: boolean;
  /** Stale-draft conflict: wait for Reload / Save anyway — do not keep overwriting. */
  conflict: boolean;
  /** A save (manual or auto) is already in flight. */
  saving: boolean;
};

/** Whether a debounced autosave timer should be armed for the current editor state. */
export function shouldScheduleAutosave({ dirty, conflict, saving }: AutosaveGate): boolean {
  return dirty && !conflict && !saving;
}

export type DraftStatusInput = {
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  conflict: boolean;
};

/** Short status line under the store name (and for a11y). */
export function draftStatusLabel({ dirty, saving, publishing, conflict }: DraftStatusInput): string {
  if (conflict) return "Draft conflict — reload or save anyway";
  if (publishing) return "Publishing…";
  if (saving) return "Saving draft…";
  if (dirty) return "Unsaved changes";
  return "All changes saved";
}

/** True when the public error is an optimistic-concurrency stale draft. */
export function isStaleDraftConflict(code: string | undefined): boolean {
  return code === "CONFLICT";
}
