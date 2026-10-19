/**
 * Sarvam AI language coverage for Saaras STT, Bulbul TTS, Sarvam-105B chat,
 * Mayura translation (11), and Sarvam-Translate (23).
 *
 * Codes are BCP-47 (`xx-IN`). Capability flags follow current Sarvam docs:
 * - STT (Saaras): all 23
 * - Chat (Sarvam-105B) + TTS (Bulbul): 11 (English + 10 major Indian)
 * - Translate: Mayura covers the same 11; Sarvam-Translate covers all 23
 *   (`translate` is true for every locale; use `mayura` for the 11-language set)
 */

export type SarvamLocaleCode =
  | "en-IN"
  | "hi-IN"
  | "bn-IN"
  | "ta-IN"
  | "te-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "mr-IN"
  | "od-IN"
  | "pa-IN"
  | "as-IN"
  | "brx-IN"
  | "doi-IN"
  | "kok-IN"
  | "ks-IN"
  | "mai-IN"
  | "mni-IN"
  | "ne-IN"
  | "sa-IN"
  | "sat-IN"
  | "sd-IN"
  | "ur-IN";

export type SarvamCapability = "stt" | "chat" | "tts" | "translate" | "mayura";

export type SarvamLocale = {
  /** BCP-47 language code used by Sarvam APIs. */
  code: SarvamLocaleCode;
  /** Native-script label for language pickers. */
  label: string;
  /** English name for accessibility / fallbacks. */
  englishName: string;
  /** Alias of `label` (native script). */
  nativeLabel: string;
  /** Alias of `englishName`. */
  name: string;
  /** Saaras STT (all 23). */
  stt: boolean;
  /** Sarvam-105B chat (11). */
  chat: boolean;
  /** Bulbul TTS (11). */
  tts: boolean;
  /** Sarvam-Translate (all 23). */
  translate: boolean;
  /** Mayura translation (same 11 as chat/TTS). */
  mayura: boolean;
};

/** The 11-language set shared by Bulbul, Mayura, and Sarvam-105B. */
export const SARVAM_CHAT_TTS_CODES = [
  "en-IN",
  "hi-IN",
  "bn-IN",
  "ta-IN",
  "te-IN",
  "gu-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "od-IN",
  "pa-IN",
] as const satisfies readonly SarvamLocaleCode[];

const MAJOR = new Set<string>(SARVAM_CHAT_TTS_CODES);

function locale(code: SarvamLocaleCode, englishName: string, label: string): SarvamLocale {
  const major = MAJOR.has(code);
  return {
    code,
    label,
    englishName,
    nativeLabel: label,
    name: englishName,
    stt: true,
    chat: major,
    tts: major,
    translate: true,
    mayura: major,
  };
}

/** Full Saaras STT list: 22 Indian languages + English (23). */
export const SARVAM_LOCALES: readonly SarvamLocale[] = [
  locale("en-IN", "English", "English"),
  locale("hi-IN", "Hindi", "हिन्दी"),
  locale("bn-IN", "Bengali", "বাংলা"),
  locale("ta-IN", "Tamil", "தமிழ்"),
  locale("te-IN", "Telugu", "తెలుగు"),
  locale("gu-IN", "Gujarati", "ગુજરાતી"),
  locale("kn-IN", "Kannada", "ಕನ್ನಡ"),
  locale("ml-IN", "Malayalam", "മലയാളം"),
  locale("mr-IN", "Marathi", "मराठी"),
  locale("od-IN", "Odia", "ଓଡ଼ିଆ"),
  locale("pa-IN", "Punjabi", "ਪੰਜਾਬੀ"),
  locale("as-IN", "Assamese", "অসমীয়া"),
  locale("brx-IN", "Bodo", "बर'"),
  locale("doi-IN", "Dogri", "डोगरी"),
  locale("kok-IN", "Konkani", "कोंकणी"),
  locale("ks-IN", "Kashmiri", "کٲشُر"),
  locale("mai-IN", "Maithili", "मैथिली"),
  locale("mni-IN", "Manipuri", "মৈতৈলোন্"),
  locale("ne-IN", "Nepali", "नेपाली"),
  locale("sa-IN", "Sanskrit", "संस्कृतम्"),
  locale("sat-IN", "Santali", "संताली"),
  locale("sd-IN", "Sindhi", "سنڌي"),
  locale("ur-IN", "Urdu", "اردو"),
] as const;

const BY_CODE: ReadonlyMap<string, SarvamLocale> = new Map(SARVAM_LOCALES.map((l) => [l.code, l]));

export function isSarvamLocaleCode(value: string): value is SarvamLocaleCode {
  return BY_CODE.has(value);
}

/** @deprecated Prefer `isSarvamLocaleCode`. */
export const isSarvamLocale = isSarvamLocaleCode;

/**
 * Normalize short codes (`hi`, `en`) or BCP-47 (`hi-IN`) to a Sarvam locale.
 * Returns null when the language is unknown.
 */
export function toSarvamLocaleCode(value: string): SarvamLocaleCode | null {
  const raw = value.trim().replaceAll("_", "-");
  if (!raw) return null;
  if (isSarvamLocaleCode(raw)) return raw;
  const base = raw.split("-")[0]?.toLowerCase();
  if (!base) return null;
  const candidate = `${base}-IN`;
  return isSarvamLocaleCode(candidate) ? candidate : null;
}

/** Alias used by the Sarvam client wrappers. */
export const normalizeSarvamLocale = toSarvamLocaleCode;

export function getSarvamLocale(code: string): SarvamLocale | undefined {
  const normalized = toSarvamLocaleCode(code);
  return normalized ? BY_CODE.get(normalized) : undefined;
}

/** Locales that support a given capability flag. */
export function localesSupporting(capability: SarvamCapability): SarvamLocale[] {
  return SARVAM_LOCALES.filter((l) => l[capability]);
}

/** Locale used for Chat when the seller's STT language lacks native chat support. */
export function chatLocaleFor(code: SarvamLocaleCode): SarvamLocaleCode {
  const loc = BY_CODE.get(code);
  if (loc?.chat) return code;
  return "en-IN";
}

/** Locale used for Bulbul TTS, or null when the locale has no TTS. */
export function ttsLocaleFor(code: SarvamLocaleCode): SarvamLocaleCode | null {
  const loc = BY_CODE.get(code);
  if (loc?.tts) return code;
  return null;
}

/** Pick Mayura for the 11-language set; otherwise Sarvam-Translate. */
export function recommendedTranslateModel(
  source: SarvamLocaleCode | "auto",
  target: SarvamLocaleCode,
): "mayura:v1" | "sarvam-translate:v1" {
  const sourceOk = source === "auto" || MAJOR.has(source);
  return sourceOk && MAJOR.has(target) ? "mayura:v1" : "sarvam-translate:v1";
}
