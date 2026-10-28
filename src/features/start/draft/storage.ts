"use client";

import { START_DRAFT_COOKIE, START_DRAFT_STORAGE_KEY, type StartDraft } from "./schema";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeStartDraft(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function readStartDraftRaw(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(START_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStartDraft(draft: StartDraft): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(START_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
  // Done keeps LS for the success UI but must not look "in progress" to mid-journey gates.
  if (draft.screen !== "welcome" && draft.screen !== "done") {
    setStartDraftCookie();
  }
  emit();
}

export function setStartDraftCookie(): void {
  if (!isBrowser()) return;
  document.cookie = `${START_DRAFT_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** Expire the in-progress cookie without wiping localStorage (e.g. Done screen still needs the draft). */
export function clearStartDraftCookie(): void {
  if (!isBrowser()) return;
  document.cookie = `${START_DRAFT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function clearStartDraftStorage(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(START_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  clearStartDraftCookie();
  emit();
}
