/**
 * Locales with full start/onboarding UI copy (English + 9 Indian languages, all covered by Sarvam
 * chat, TTS and STT). Order is the order shown on /start/lang and in the language menu.
 * Other Sarvam codes stay STT-only.
 */
export const START_UI_LOCALES = [
  "en-IN",
  "hi-IN",
  "bn-IN",
  "ta-IN",
  "te-IN",
  "mr-IN",
  "gu-IN",
  "kn-IN",
  "ml-IN",
  "pa-IN",
] as const;

export type StartUiLocale = (typeof START_UI_LOCALES)[number];

export function isStartUiLocale(code: string): code is StartUiLocale {
  return (START_UI_LOCALES as readonly string[]).includes(code);
}
