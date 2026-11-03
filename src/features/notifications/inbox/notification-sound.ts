"use client";

import { DEFAULT_SOUND_PREFS, SOUND_PREF_STORAGE_KEY, parseSoundPrefs, serializeSoundPrefs, toneFileFor, type NotificationSoundPrefs, type NotificationToneId } from "./sound-prefs";

let unlockBound = false;
let unlocked = false;
let sharedCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new Ctor();
  return sharedCtx;
}

async function resumeContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Autoplay policy: stay silent until a later gesture.
    }
  }
  unlocked = ctx.state === "running";
}

/**
 * Browsers block audio until a user gesture. Call once from the dashboard shell / bell so the
 * first notification after a click/key/touch can play without a second gesture.
 */
export function unlockNotificationAudio(): void {
  if (typeof document === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    void resumeContext(ctx).then(() => {
      // Tiny silent buffer primes some mobile browsers.
      try {
        const node = ctx.createBufferSource();
        node.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        node.connect(ctx.destination);
        node.start(0);
      } catch {
        // ignore
      }
    });
  };
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
  document.addEventListener("keydown", unlock, { once: true, capture: true });
  document.addEventListener("touchstart", unlock, { once: true, capture: true });
}

const prefsListeners = new Set<() => void>();

/**
 * Cached snapshots for `useSyncExternalStore`. Returning a fresh object from getSnapshot on
 * every call makes React think the store changed → infinite re-render → React error #185.
 */
const SERVER_SOUND_PREFS: NotificationSoundPrefs = DEFAULT_SOUND_PREFS;
let clientSoundPrefs: NotificationSoundPrefs = DEFAULT_SOUND_PREFS;
let clientSoundRaw: string | null | undefined = undefined;

/** Subscribe to local sound-pref changes (for `useSyncExternalStore`). */
export function subscribeSoundPrefs(onStoreChange: () => void): () => void {
  prefsListeners.add(onStoreChange);
  return () => {
    prefsListeners.delete(onStoreChange);
  };
}

/** Stable getServerSnapshot — same reference every call. */
export function getServerSoundPrefs(): NotificationSoundPrefs {
  return SERVER_SOUND_PREFS;
}

/** Stable getSnapshot — same reference until localStorage actually changes. */
export function readSoundPrefs(): NotificationSoundPrefs {
  if (typeof window === "undefined") return SERVER_SOUND_PREFS;
  try {
    const raw = localStorage.getItem(SOUND_PREF_STORAGE_KEY);
    if (raw === clientSoundRaw) return clientSoundPrefs;
    clientSoundRaw = raw;
    clientSoundPrefs = parseSoundPrefs(raw);
    return clientSoundPrefs;
  } catch {
    return clientSoundPrefs;
  }
}

export function writeSoundPrefs(prefs: NotificationSoundPrefs): void {
  if (typeof window === "undefined") return;
  const next: NotificationSoundPrefs = {
    enabled: Boolean(prefs.enabled),
    toneId: prefs.toneId,
  };
  // Skip notify when nothing changed (avoids feedback loops with controlled UIs).
  if (next.enabled === clientSoundPrefs.enabled && next.toneId === clientSoundPrefs.toneId && clientSoundRaw !== undefined) {
    return;
  }
  const serialized = serializeSoundPrefs(next);
  try {
    localStorage.setItem(SOUND_PREF_STORAGE_KEY, serialized);
  } catch {
    // private mode / quota — prefs stay in-memory for this session only via callers
  }
  clientSoundRaw = serialized;
  clientSoundPrefs = next;
  for (const listener of prefsListeners) listener();
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    bufferCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Play the configured (or given) tone. No-ops when audio is locked or decode fails. */
export async function playNotificationTone(toneId?: NotificationToneId): Promise<void> {
  const prefs = readSoundPrefs();
  if (!prefs.enabled) return;
  const id = toneId ?? prefs.toneId;
  const ctx = getAudioContext();
  if (!ctx) return;
  await resumeContext(ctx);
  if (ctx.state !== "running") return;
  const buf = await loadBuffer(ctx, toneFileFor(id));
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.85;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
}

export function isNotificationAudioUnlocked(): boolean {
  return unlocked;
}
