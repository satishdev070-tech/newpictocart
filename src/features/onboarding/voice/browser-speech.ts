/**
 * Browser speech engines for the Tara call. The browser's own speech recognition (Web Speech API)
 * is the primary listener, so hearing never depends on one paid STT provider.
 * `speechSynthesis` speaks Tara's reply when the server sends no audio.
 *
 * The pure helpers (locale map, voice picker, caption reducer, error classification) are
 * unit-tested. The thin DOM accessors at the bottom are safe on the server: they return null there.
 */

import { voiceGenderScore } from "@/lib/speech/voice-gender";

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

function normTag(tag: string): string {
  return tag.trim().replace(/_/g, "-").toLowerCase();
}

/**
 * Best `speechSynthesis` voice for a locale, or null if none speaks the language (the caller
 * then stays silent instead of reading Hindi with an English voice). Order of preference:
 * exact tag (hi-IN) → same language, Indian region → same language elsewhere. Within each
 * group, prefer a female voice, then an on-device voice, then the platform default.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: string): V | null {
  const want = normTag(recognitionLang(locale));
  const lang = primaryLanguage(want);
  const score = (v: V): number | null => {
    const tag = normTag(v.lang);
    if (primaryLanguage(tag) !== lang) return null;
    let s = tag === want ? 300 : tag.endsWith("-in") ? 200 : 100;
    // Tara is a woman: a female voice wins over a male one of a closer region.
    s += voiceGenderScore(v.name) * 150; // female outranks region (never language)
    if (v.localService) s += 10;
    if (v.default) s += 5;
    return s;
  };
  let best: V | null = null;
  let bestScore = -Infinity; // male-only devices score below 0 and must still get a voice
  for (const v of voices) {
    const s = score(v);
    if (s !== null && s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

/** Safety timeout for an utterance whose `onend` never fires (some engines drop it). */
export function utteranceTimeoutMs(text: string): number {
  return Math.min(60_000, 4_000 + text.length * 110);
}

// ---- live caption reducer ---------------------------------------------------------------

/**
 * What the seller has said in the current turn. A turn can span several recognition sessions
 * (a session ends after each pause, and we restart it until the end-of-turn timer fires).
 */
export type CaptionState = {
  /** Text from earlier sessions in this turn. */
  committed: string;
  /** Final results of the running session. */
  final: string;
  /** Interim (still changing) text of the running session. */
  interim: string;
};

export type RecognitionPiece = { text: string; isFinal: boolean };

export type CaptionEvent =
  /** The full results list of the running session (SpeechRecognitionEvent.results). */
  | { type: "results"; pieces: readonly RecognitionPiece[] }
  /** The session ended. Its text is kept for the turn. */
  | { type: "session-end" }
  | { type: "reset" };

export const emptyCaption: CaptionState = { committed: "", final: "", interim: "" };

function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

export function captionReducer(s: CaptionState, e: CaptionEvent): CaptionState {
  switch (e.type) {
    case "results": {
      const final = join(...e.pieces.filter((p) => p.isFinal).map((p) => p.text));
      const interim = join(...e.pieces.filter((p) => !p.isFinal).map((p) => p.text));
      if (final === s.final && interim === s.interim) return s;
      return { ...s, final, interim };
    }
    case "session-end": {
      // Engines that end without a final result leave the last interim text: keep it.
      const committed = join(s.committed, s.final, s.interim);
      if (committed === s.committed && !s.final && !s.interim) return s;
      return { committed, final: "", interim: "" };
    }
    case "reset":
      return s === emptyCaption ? s : emptyCaption;
  }
}

/** Everything heard so far in this turn (shown live, sent as the turn text). */
export function captionText(s: CaptionState): string {
  return join(s.committed, s.final, s.interim);
}

/** True once the turn holds any text. */
export function captionHasText(s: CaptionState): boolean {
  return captionText(s).length > 0;
}

/** Results list (DOM shape) → plain pieces. */
export function piecesFromResults(results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>): RecognitionPiece[] {
  const out: RecognitionPiece[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || r.length === 0) continue;
    out.push({ text: r[0]?.transcript ?? "", isFinal: r.isFinal });
  }
  return out;
}

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

/** Quiet time after the last recognised words before the turn is sent. */
export const END_OF_TURN_MS = 1_200;
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
