"use client";

import { START_DRAFT_COOKIE, START_DRAFT_STORAGE_KEY, type StartDraft } from "./schema";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const listeners = new Set<() => void>();

/** Bumped on clear so in-memory draft snapshots miss even with zero subscribers. */
let storageEpoch = 0;

export function startDraftStorageEpoch(): number {
  return storageEpoch;
}

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

/** When the draft was last saved (ms), kept beside it. */
const SAVED_AT_KEY = `${START_DRAFT_STORAGE_KEY}.savedAt`;
/** Tara's chat on a shared device is private: after this long idle, the transcript is dropped. */
export const TARA_CHAT_IDLE_MS = 2 * 60 * 60 * 1000;

/**
 * Drops `voice.turns` from a stored draft when it was saved longer ago than TARA_CHAT_IDLE_MS
 * (pure; unit tested). The store details gathered so far stay so the merchant can resume.
 */
export function withoutStaleChat(raw: string | null, savedAt: number | null, now = Date.now()): string | null {
  if (!raw) return raw;
  if (savedAt !== null && now - savedAt <= TARA_CHAT_IDLE_MS) return raw;
  try {
    const d = JSON.parse(raw) as { voice?: { turns?: unknown[] } };
    if (!d.voice?.turns?.length) return raw;
    return JSON.stringify({ ...d, voice: { ...d.voice, turns: [] } });
  } catch {
    return raw;
  }
}

export function readStartDraftRaw(): string | null {
  if (!isBrowser()) return null;
  try {
    const savedAt = Number(localStorage.getItem(SAVED_AT_KEY));
    return withoutStaleChat(localStorage.getItem(START_DRAFT_STORAGE_KEY), Number.isFinite(savedAt) && savedAt > 0 ? savedAt : null);
  } catch {
    return null;
  }
}

export function writeStartDraft(draft: StartDraft): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(START_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
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
    localStorage.removeItem(SAVED_AT_KEY);
  } catch {
    /* ignore */
  }
  clearStartDraftCookie();
  storageEpoch += 1;
  emit();
}
