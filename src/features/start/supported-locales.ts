/** Locales with full start/onboarding UI copy. Other Sarvam codes stay STT/TTS-only. */
export const START_UI_LOCALES = ["en-IN", "hi-IN"] as const;

export type StartUiLocale = (typeof START_UI_LOCALES)[number];

export function isStartUiLocale(code: string): code is StartUiLocale {
  return (START_UI_LOCALES as readonly string[]).includes(code);
}
