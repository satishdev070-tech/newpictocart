/**
 * Pure helpers for the site builder's local-first save loop:
 * edit → canvas paints from local history → debounced Save draft → explicit Publish.
 *
 * Contract: `shouldScheduleAutosave` answers only “may we arm an idle timer?” — never “may we
 * paint?”. Colour / slider / text handlers call `apply()`; top-bar schedules persist after idle.
 * Publish invalidates public storefront tags via `revalidateStorefront` (ADR-010); drafts never
 * touch Redis.
 */

/** Idle delay before an automatic draft save (ms). Manual Save remains immediate. */
export const AUTOSAVE_IDLE_MS = 2500;

/**
 * While the document stays dirty through continuous edits, force a draft flush at least
 * this often so long sessions sync without depending only on idle. Manual Save / exit flush
 * remain immediate.
 */
export const AUTOSAVE_MAX_WAIT_MS = 10_000;

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

/**
 * Delay until the max-wait flush should fire, given when the current dirty streak began.
 * `null` means do not arm a max-wait timer (not dirty / already past — caller flushes now).
 */
export function autosaveMaxWaitDelayMs(dirtySinceMs: number | null, nowMs: number, maxWaitMs: number = AUTOSAVE_MAX_WAIT_MS): number | null {
  if (dirtySinceMs == null) return null;
  const remaining = maxWaitMs - (nowMs - dirtySinceMs);
  return remaining > 0 ? remaining : 0;
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
