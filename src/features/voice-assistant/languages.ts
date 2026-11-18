/**
 * Voice assistant languages (pure; client + server). MVP: English (India), Hindi and Hinglish.
 * More locales are added only after their STT and TTS are tested on real browsers
 * (docs/voice-assistant/PLAN.md "Languages").
 */
export const ASSISTANT_LOCALES = ["en-IN", "hi-IN", "hinglish"] as const;
export type AssistantLocale = (typeof ASSISTANT_LOCALES)[number];

export const ASSISTANT_LOCALE_LABELS: Record<AssistantLocale, { label: string; short: string }> = {
  "en-IN": { label: "English", short: "EN" },
  "hi-IN": { label: "हिन्दी", short: "हि" },
  hinglish: { label: "Hinglish", short: "HiEn" },
};

export function isAssistantLocale(v: unknown): v is AssistantLocale {
  return typeof v === "string" && (ASSISTANT_LOCALES as readonly string[]).includes(v);
}

/**
 * BCP-47 tag for the browser's SpeechRecognition / speechSynthesis. Hinglish is spoken and read
 * back in Roman script, which the en-IN recogniser and voices handle; hi-IN returns Devanagari.
 */
export function speechTagFor(locale: AssistantLocale): "en-IN" | "hi-IN" {
  return locale === "hi-IN" ? "hi-IN" : "en-IN";
}

const DEVANAGARI = /[ऀ-ॿ]/;
// Common Roman-script Hindi function words; two or more of them mark Hinglish.
const HINGLISH_WORDS = new Set([
  "hai", "hain", "ho", "kya", "kaise", "karo", "kar", "karna", "karein", "kijiye", "mera", "meri", "mere", "mujhe", "aap", "aapka",
  "nahi", "nahin", "haan", "acha", "accha", "theek", "thik", "chahiye", "wala", "wali", "bhi", "aur", "ka", "ki", "ke", "ko", "se",
  "mein", "main", "yeh", "ye", "woh", "batao", "dikhao", "badlo", "rang", "dukaan", "dukan",
]);

/**
 * Detection fallback: the merchant's chosen locale wins unless the text clearly says otherwise
 * (Devanagari → Hindi; Roman text with Hindi function words → Hinglish).
 */
export function detectLocale(text: string, chosen: AssistantLocale): AssistantLocale {
  if (DEVANAGARI.test(text)) return "hi-IN";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((w) => HINGLISH_WORDS.has(w)).length;
  if (hits >= 2 && hits / Math.max(words.length, 1) >= 0.2) return chosen === "hi-IN" ? "hi-IN" : "hinglish";
  if (chosen === "hi-IN" && words.length > 0) return words.length >= 3 && hits === 0 ? "en-IN" : chosen;
  return chosen;
}

/** Output rule for the model. Business names, numbers and ₹ amounts are kept as given. */
export function localeRule(locale: AssistantLocale): string {
  if (locale === "hi-IN") return "Reply in simple Hindi written in Devanagari script. Keep brand/business names, product names, numbers and ₹ amounts exactly as the merchant wrote them.";
  if (locale === "hinglish") return "Reply in natural Hinglish (Hindi + English mixed) written in Roman/Latin script, the way Indian shopkeepers text. Keep names, numbers and ₹ amounts as given.";
  return "Reply in simple Indian English. Keep names, numbers and ₹ amounts as given.";
}
