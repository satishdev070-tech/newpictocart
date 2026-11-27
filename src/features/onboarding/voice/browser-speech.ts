/**
 * Browser speech engines for the Tara call. The browser's own speech recognition (Web Speech API)
 * is the primary listener, so hearing never depends on one paid STT provider.
 * `speechSynthesis` speaks Tara's reply when the server sends no audio.
 *
 * The pure helpers (locale map, voice picker, caption reducer, error classification) are
 * unit-tested. The thin DOM accessors at the bottom are safe on the server: they return null there.
 */

import { chooseVoice } from "@/lib/speech/voices";

// ---- locale → recognition language ------------------------------------------------------

/** Recognition tags that differ from our Sarvam locale codes. */
const RECOGNITION_LANG_OVERRIDES: Record<string, string> = {
  "od-IN": "or-IN", // Odia: BCP-47 is "or"; Sarvam uses "od"
};

/** BCP-47 tag for `SpeechRecognition.lang` / voice matching for a draft locale (e.g. "hi-IN"). */
export function recognitionLang(locale: string | null | undefined): string {
  const code = (locale ?? "").trim();
  if (!code) return "en-IN";
  const override = RECOGNITION_LANG_OVERRIDES[code];
  if (override) return override;
  return /^[a-z]{2,3}-[A-Z]{2}$/.test(code) ? code : "en-IN";
}

/** Primary language subtag ("hi-IN" → "hi"), lower-cased. Accepts "hi_IN" too (Android voices). */
export function primaryLanguage(tag: string): string {
  return tag.trim().replace(/_/g, "-").split("-")[0]!.toLowerCase();
}

// ---- voice picker ------------------------------------------------------------------------

export type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "name" | "localService" | "default">;

/**
 * Best `speechSynthesis` voice for a locale, or null if none speaks the language (the caller
 * then stays silent instead of reading Hindi with an English voice). Shared ranking
 * (`lib/speech/voices.ts`): exact tag → India → elsewhere; female; most natural-sounding.
 * `preferredName` is the seller's saved voice, used when this device has it.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: string, preferredName?: string | null): V | null {
  return chooseVoice(voices, recognitionLang(locale), preferredName);
}

/** Safety timeout for an utterance whose `onend` never fires (some engines drop it). */
export function utteranceTimeoutMs(text: string): number {
  return Math.min(60_000, 4_000 + text.length * 110);
}

// ---- live caption reducer (shared: lib/speech/caption.ts) -----------------------------

export { captionHasText, captionReducer, captionText, emptyCaption, piecesFromResults } from "@/lib/speech/caption";
export type { CaptionEvent, CaptionState, RecognitionPiece } from "@/lib/speech/caption";

// ---- recognition errors -----------------------------------------------------------------

/**
 * What to do with a `SpeechRecognitionErrorEvent.error`:
 * - `retry`: nothing heard. Restart quietly.
 * - `blocked`: mic or speech service not allowed. Use the mic-blocked flow.
 * - `fallback`: the engine can't serve this call. Use MediaRecorder + server STT.
 * - `ignore`: we aborted it ourselves.
 */
export type RecognitionErrorAction = "retry" | "blocked" | "fallback" | "ignore";

export function classifyRecognitionError(error: string): RecognitionErrorAction {
  switch (error) {
    case "no-speech":
      return "retry";
    case "aborted":
      return "ignore";
    case "not-allowed":
    case "service-not-allowed":
      return "blocked";
    default:
      // network, language-not-supported, audio-capture, bad-grammar, unknown
      return "fallback";
  }
}

/** Hands-free mode only: quiet time after the last recognised words before the turn is sent. */
export const END_OF_TURN_MS = 1_200;
/**
 * Default ("listen until Done") mode: thinking pauses never end the turn. Only the merchant's
 * Done tap does; this long quiet stretch after speech is just the safety net (opens the review).
 */
export const LONG_PAUSE_MS = 30_000;
/** "I didn't catch that" after this many no-speech sessions in a row. */
export const NO_SPEECH_NOTICE_AFTER = 2;

// ---- DOM accessors (client only) --------------------------------------------------------

/** Minimal Web Speech recognition surface we use (not in lib.dom for all TS targets). */
export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type BrowserRecognitionCtor = new () => BrowserRecognition;

export function speechRecognitionCtor(): BrowserRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: BrowserRecognitionCtor; webkitSpeechRecognition?: BrowserRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSynthesisApi(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return null;
  return window.speechSynthesis;
}

/**
 * Call inside the Start tap: loads the voice list (async in Chrome) and speaks a silent
 * utterance so iOS Safari allows speech later outside the gesture.
 */
export function primeSpeechSynthesis(): void {
  const synth = speechSynthesisApi();
  if (!synth) return;
  try {
    synth.getVoices();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  } catch {
    /* best effort */
  }
}

/** Voices, waiting briefly for Chrome's async `voiceschanged` on first use. */
export function loadVoices(timeoutMs = 1_500): Promise<SpeechSynthesisVoice[]> {
  const synth = speechSynthesisApi();
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      window.clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = window.setTimeout(done, timeoutMs);
    synth.addEventListener("voiceschanged", done);
  });
}
