/**
 * "Ask Pictocart AI" reply languages (pure; client + server). The ten panel languages the copilot
 * can answer and speak in. The choice is a UI preference sent with each question and validated
 * server-side against this list; nothing else trusts it.
 */
export const COPILOT_LANGUAGES = ["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa"] as const;
export type CopilotLanguage = (typeof COPILOT_LANGUAGES)[number];

/** Native-script name (picker) and English name (prompt rule). */
export const COPILOT_LANGUAGE_NAMES: Record<CopilotLanguage, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  hi: { native: "हिन्दी", english: "Hindi" },
  bn: { native: "বাংলা", english: "Bengali" },
  ta: { native: "தமிழ்", english: "Tamil" },
  te: { native: "తెలుగు", english: "Telugu" },
  mr: { native: "मराठी", english: "Marathi" },
  gu: { native: "ગુજરાતી", english: "Gujarati" },
  kn: { native: "ಕನ್ನಡ", english: "Kannada" },
  ml: { native: "മലയാളം", english: "Malayalam" },
  pa: { native: "ਪੰਜਾਬੀ", english: "Punjabi" },
};

export function isCopilotLanguage(v: unknown): v is CopilotLanguage {
  return typeof v === "string" && (COPILOT_LANGUAGES as readonly string[]).includes(v);
}

/** "hi-IN" / "HI" / "hi" → "hi"; anything else → English. */
export function parseCopilotLanguage(raw: string | null | undefined): CopilotLanguage {
  const base = raw?.trim().toLowerCase().split(/[-_]/)[0];
  return isCopilotLanguage(base) ? base : "en";
}

/** Sarvam BCP-47 code for speech (every copilot language has STT + TTS). */
export function sarvamCodeFor(lang: CopilotLanguage): `${CopilotLanguage}-IN` {
  return `${lang}-IN`;
}

/** Output rule for the model: native script, keep names / numbers / ₹ as they are. */
export function copilotLanguageRule(lang: CopilotLanguage): string {
  if (lang === "en") return "Write every text value in simple Indian English.";
  const name = COPILOT_LANGUAGE_NAMES[lang].english;
  return `Write the answer in simple ${name}, in its native script. Keep product names, service names, brand names, numbers, ₹ amounts and dashboard page names as they are. Text inside proposals is shown to customers on the website: write it in English unless the seller asks for another language.`;
}
