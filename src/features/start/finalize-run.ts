"use client";

import {
  startCreateStoreAction,
  startFinishAction,
  startPublishThemeAction,
  startSeedCatalogAction,
  startSeedContentAction,
  startSeedImagesAction,
} from "./actions";
import {
  initialFinalizeProgress,
  parseFinalizeProgress,
  runFinalizePhases,
  type FinalizeApi,
  type FinalizeProgress,
  type FinalizeRunResult,
} from "./finalize-phases";

/** Resume point of the phased finalize, kept beside the start draft in this browser. */
export const FINALIZE_PROGRESS_KEY = "pc_start_finalize_v1";

let current: FinalizeProgress | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function readFinalizeProgress(): FinalizeProgress {
  if (current) return current;
  let raw: unknown = null;
  try {
    const text =
      typeof window !== "undefined"
        ? localStorage.getItem(FINALIZE_PROGRESS_KEY)
        : null;
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  current = parseFinalizeProgress(raw);
  return current;
}

export function saveFinalizeProgress(p: FinalizeProgress): void {
  current = p;
  try {
    localStorage.setItem(FINALIZE_PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota */
  }
  emit();
}

export function clearFinalizeProgress(): void {
  current = initialFinalizeProgress();
  try {
    localStorage.removeItem(FINALIZE_PROGRESS_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function subscribeFinalizeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const api: FinalizeApi = {
  createStore: (draftJson) => startCreateStoreAction({ draftJson }),
  seedCatalog: (draftJson, slug, step) =>
    startSeedCatalogAction({ draftJson, slug, step }),
  seedContent: (draftJson, slug) => startSeedContentAction({ draftJson, slug }),
  seedImages: (draftJson, slug, skip) =>
    startSeedImagesAction({ draftJson, slug, skip }),
  publishTheme: (draftJson, slug) =>
    startPublishThemeAction({ draftJson, slug }),
  finish: (draftJson, slug) => startFinishAction({ draftJson, slug }),
};

/** Runs (or resumes) the phased finalize for this draft. Wrap in `finalizeOnce` for single-flight. */
export function runStartFinalize(
  draftJson: string,
): Promise<FinalizeRunResult> {
  return runFinalizePhases(draftJson, readFinalizeProgress(), api, {
    save: saveFinalizeProgress,
  });
}
