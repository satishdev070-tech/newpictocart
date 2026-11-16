import "server-only";
import { isSarvamConfigured, synthesizeSpeech } from "@/lib/sarvam/client";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import { taraGreetingText, type TaraGreetingKind } from "./greetings";

export type TaraSpokenLine = {
  text: string;
  /** Bulbul audio (base64) or null when TTS is off / unavailable for the locale. */
  audioBase64: string | null;
  mimeType: string | null;
};

/**
 * Per-isolate cache: the opener is the same for every seller of a locale, so each Worker
 * isolate pays one TTS call per (locale, kind) instead of one per call start.
 */
const cache = new Map<string, Promise<TaraSpokenLine>>();

/** Text + TTS audio for Tara's spoken opener. Never throws: on any failure the text stands alone. */
export function taraSpokenGreeting(locale: SarvamLocaleCode, kind: TaraGreetingKind = "welcome"): Promise<TaraSpokenLine> {
  const text = taraGreetingText(locale, kind);
  if (!isSarvamConfigured()) return Promise.resolve({ text, audioBase64: null, mimeType: null });
  const key = `${locale}:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = synthesizeSpeech({ text, languageCode: locale })
    .then((speech) => ({ text, audioBase64: speech?.audioBase64 ?? null, mimeType: speech?.mimeType ?? null }))
    .catch(() => ({ text, audioBase64: null, mimeType: null }))
    .then((line) => {
      if (!line.audioBase64) cache.delete(key); // retry TTS next time rather than caching a miss
      return line;
    });
  cache.set(key, pending);
  return pending;
}
