import { describe, expect, it } from "vitest";
import {
  SARVAM_CHAT_TTS_CODES,
  SARVAM_LOCALES,
  getSarvamLocale,
  isSarvamLocaleCode,
  localesSupporting,
  recommendedTranslateModel,
  toSarvamLocaleCode,
} from "@/lib/sarvam/locales";

describe("sarvam locales", () => {
  it("lists all 23 Saaras languages with unique BCP-47 codes", () => {
    expect(SARVAM_LOCALES).toHaveLength(23);
    const codes = SARVAM_LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(23);
    expect(codes).toContain("en-IN");
    expect(codes).toContain("hi-IN");
    expect(codes).toContain("doi-IN");
  });

  it("marks STT + Sarvam-Translate for every locale and keeps native labels", () => {
    for (const locale of SARVAM_LOCALES) {
      expect(locale.stt).toBe(true);
      expect(locale.translate).toBe(true);
      expect(locale.label.length).toBeGreaterThan(0);
      expect(locale.nativeLabel).toBe(locale.label);
      expect(locale.name).toBe(locale.englishName);
    }
  });

  it("limits chat/TTS/Mayura to the documented 11-language set", () => {
    expect(SARVAM_CHAT_TTS_CODES).toHaveLength(11);
    expect(localesSupporting("chat")).toHaveLength(11);
    expect(localesSupporting("tts")).toHaveLength(11);
    expect(localesSupporting("mayura")).toHaveLength(11);

    for (const code of SARVAM_CHAT_TTS_CODES) {
      const locale = getSarvamLocale(code);
      expect(locale?.chat).toBe(true);
      expect(locale?.tts).toBe(true);
      expect(locale?.mayura).toBe(true);
    }

    const assamese = getSarvamLocale("as-IN");
    expect(assamese?.stt).toBe(true);
    expect(assamese?.chat).toBe(false);
    expect(assamese?.tts).toBe(false);
    expect(assamese?.mayura).toBe(false);
    expect(assamese?.translate).toBe(true);
  });

  it("normalizes short language codes to BCP-47", () => {
    expect(toSarvamLocaleCode("hi")).toBe("hi-IN");
    expect(toSarvamLocaleCode("en")).toBe("en-IN");
    expect(toSarvamLocaleCode("ta-IN")).toBe("ta-IN");
    expect(toSarvamLocaleCode("fr")).toBeNull();
  });

  it("picks Mayura vs Sarvam-Translate from locale coverage", () => {
    expect(recommendedTranslateModel("en-IN", "hi-IN")).toBe("mayura:v1");
    expect(recommendedTranslateModel("auto", "ta-IN")).toBe("mayura:v1");
    expect(recommendedTranslateModel("as-IN", "hi-IN")).toBe("sarvam-translate:v1");
    expect(recommendedTranslateModel("hi-IN", "as-IN")).toBe("sarvam-translate:v1");
  });

  it("type-guards locale codes", () => {
    expect(isSarvamLocaleCode("hi-IN")).toBe(true);
    expect(isSarvamLocaleCode("hi")).toBe(false);
    expect(isSarvamLocaleCode("fr-FR")).toBe(false);
  });
});
