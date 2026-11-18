"use client";

/**
 * Browser speech for the voice assistant. Speech-to-text uses the browser's SpeechRecognition
 * (Chrome/Edge/Safari; Chrome sends the audio to Google's speech service — the privacy notice
 * says so). Pictocart never records, uploads or stores audio. Text-to-speech uses speechSynthesis
 * with an installed voice for the locale, and falls back to text only.
 */

type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
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

// ---- Text-to-speech ----------------------------------------------------------------------------

/** Best installed voice for a BCP-47 tag: exact match, then same language, else null. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const want = lang.toLowerCase();
  const base = want.split("-")[0]!;
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  return voices.find((v) => norm(v) === want) ?? voices.find((v) => norm(v).split("-")[0] === base) ?? null;
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
