"use client";

import { voiceGenderScore } from "./voice-gender";
import { captionReducer, captionText, emptyCaption, piecesFromResults, type CaptionState } from "./caption";

/**
 * Browser speech for the voice assistant. Speech-to-text uses the browser's SpeechRecognition
 * (Chrome/Edge/Safari; Chrome sends the audio to Google's speech service — the privacy notice
 * says so). Pictocart never records, uploads or stores audio. Text-to-speech uses speechSynthesis
 * with an installed voice for the locale, and falls back to text only.
 */

type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechInputSupported = (): boolean => !!recognitionCtor();
export const speechOutputSupported = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export type ListenError = "not-allowed" | "no-speech" | "network" | "unsupported" | "aborted" | "other";

export type ListenHandle = { stop: () => void; abort: () => void };

/**
 * One utterance. `onInterim` streams partial text; `onFinal` gets the full transcript ("" when
 * nothing was heard); `onError` gets a normalised reason. Exactly one of onFinal / onError fires.
 */
export function listen(
  lang: string,
  cb: { onInterim: (text: string) => void; onSpeechEnd?: () => void; onFinal: (text: string) => void; onError: (reason: ListenError) => void },
): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    cb.onError("unsupported");
    return null;
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = "";
  let interim = "";
  let settled = false;
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };
  rec.onresult = (e) => {
    interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    cb.onInterim((finalText + " " + interim).trim());
  };
  rec.onspeechend = () => cb.onSpeechEnd?.();
  rec.onerror = (e) => {
    const map: Record<string, ListenError> = { "not-allowed": "not-allowed", "service-not-allowed": "not-allowed", "no-speech": "no-speech", network: "network", aborted: "aborted" };
    const reason = map[e.error] ?? "other";
    // "no-speech" with nothing captured is just an empty final.
    if (reason === "no-speech") return settle(() => cb.onFinal(""));
    settle(() => cb.onError(reason));
  };
  rec.onend = () => settle(() => cb.onFinal((finalText || interim).trim()));
  try {
    rec.start();
  } catch {
    settle(() => cb.onError("other"));
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
    abort: () => {
      settled = true;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

/** Dictation hard cap (a forgotten mic must not run forever). */
export const DICTATE_MAX_MS = 180_000;
/** Dictation ends by itself after this long with no new words. */
export const DICTATE_IDLE_MS = 60_000;

const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

/**
 * Continuous dictation: keeps listening through pauses until `stop()` (like a voice-typing
 * button), so a thinking pause never cuts the merchant off. Browsers end a recognition session
 * after silence or ~60 s; we restart it and keep everything heard so far (caption reducer).
 * Android Chrome repeats text in continuous mode, so there each session is one utterance and the
 * loop does the joining. Ends with `onFinal(text)` on stop, the 3-minute cap, or 60 s without new
 * words; `onError` only when nothing was heard and the mic/service failed.
 */
export function dictate(lang: string, cb: { onInterim: (text: string) => void; onFinal: (text: string) => void; onError: (reason: ListenError) => void }): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    cb.onError("unsupported");
    return null;
  }
  const continuous = !isAndroid();
  const startedAt = Date.now();
  let lastWords = startedAt;
  let caption: CaptionState = emptyCaption;
  let current: Recognition | null = null;
  let restart: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let settled = false;
  let rapidEnds = 0;

  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    if (restart) clearTimeout(restart);
    fn();
  };
  const finish = () => settle(() => cb.onFinal(captionText(caption)));
  const fail = (reason: ListenError) => (captionText(caption) ? finish() : settle(() => cb.onError(reason)));

  const session = () => {
    restart = null;
    if (settled) return;
    if (stopped) return finish();
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = continuous;
    rec.maxAlternatives = 1;
    const began = Date.now();
    let error: string | null = null;
    rec.onresult = (e) => {
      if (current !== rec) return;
      const next = captionReducer(caption, { type: "results", pieces: piecesFromResults(e.results) });
      if (next !== caption) {
        caption = next;
        lastWords = Date.now();
        rapidEnds = 0;
        cb.onInterim(captionText(caption));
      }
    };
    rec.onerror = (e) => {
      error = e.error;
    };
    rec.onend = () => {
      if (current !== rec) return;
      current = null;
      caption = captionReducer(caption, { type: "session-end" });
      if (settled) return;
      if (stopped) return finish();
      if (error === "not-allowed" || error === "service-not-allowed") return fail("not-allowed");
      if (error && error !== "no-speech" && error !== "aborted") return fail(error === "network" ? "network" : "other");
      const now = Date.now();
      if (now - startedAt >= DICTATE_MAX_MS || now - lastWords >= DICTATE_IDLE_MS) return finish();
      // An engine that ends instantly again and again would spin: give up after a few tries.
      rapidEnds = now - began < 400 ? rapidEnds + 1 : 0;
      if (rapidEnds >= 5) return fail("other");
      restart = setTimeout(session, rapidEnds ? 250 : 0);
    };
    current = rec;
    try {
      rec.start();
    } catch {
      current = null;
      fail("other");
    }
  };
  session();
  if (settled && !captionText(caption)) return null;
  return {
    stop: () => {
      stopped = true;
      if (!current) return finish();
      try {
        current.stop();
      } catch {
        finish();
      }
    },
    abort: () => {
      settled = true;
      if (restart) clearTimeout(restart);
      try {
        current?.abort();
      } catch {
        /* already stopped */
      }
      current = null;
    },
  };
}

// ---- Text-to-speech ----------------------------------------------------------------------------

/**
 * Best installed voice for a BCP-47 tag: an Indian (exact-locale) female voice, then any female
 * voice of the language, then the exact locale, then on-device. Null when nothing speaks the language.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const want = lang.toLowerCase().replace("_", "-");
  const base = want.split("-")[0]!;
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity; // male-only devices score below 0 and must still get a voice
  for (const v of voices) {
    const tag = norm(v);
    if (tag.split("-")[0] !== base) continue;
    // Tara is a woman: gender outranks region (an en-US female beats an en-IN male), and the
    // Indian female voice (exact locale) beats both. Language itself is never traded away.
    const score = (tag === want ? 100 : 0) + voiceGenderScore(v.name) * 150 + (v.localService ? 2 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

export function voicesFor(lang: string): Promise<SpeechSynthesisVoice | null> {
  if (!speechOutputSupported()) return Promise.resolve(null);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(pickVoice(now, lang));
  return new Promise((resolve) => {
    const done = () => resolve(pickVoice(synth.getVoices(), lang));
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

/**
 * iOS Safari only plays speech that starts inside a user gesture. Call this from the mic tap: an
 * empty utterance "unlocks" speechSynthesis for the rest of the page's life.
 */
export function unlockSpeech(): void {
  if (!speechOutputSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function cancelSpeech(): void {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}

/** Speaks `text`; resolves when done/cancelled. Resolves false when no voice exists for `lang`. */
export async function speak(text: string, lang: string): Promise<boolean> {
  if (!speechOutputSupported() || !text.trim()) return false;
  const voice = await voicesFor(lang);
  // Hindi with no Hindi voice would be read letter by letter by an English voice: stay text-only.
  if (!voice && lang.startsWith("hi")) return false;
  cancelSpeech();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text.slice(0, 600));
    u.lang = voice?.lang ?? lang;
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.speak(u);
  });
}
