import { describe, expect, it } from "vitest";
import { VOICE_COPY_PARAMS, VOICE_EN, voiceUiCopy } from "@/features/start/components/voice/voice-copy";
import { START_COPY_PARAMS, START_EN, startCopy } from "@/features/start/copy";
import { VOICE_TRANSLATIONS } from "@/features/start/i18n/voice/index";
import { START_TRANSLATIONS } from "@/features/start/i18n/start/index";
import { fillTemplate, localize, toTemplates } from "@/features/start/i18n/templates";
import { START_UI_LOCALES } from "@/features/start/supported-locales";
import { getSarvamLocale } from "@/lib/sarvam/locales";
import { expectComplete } from "./i18n-helpers";

const EN_TEMPLATES = toTemplates(START_EN, START_COPY_PARAMS);

describe("onboarding languages", () => {
  it("offers the 10 Sarvam chat + TTS languages", () => {
    expect(START_UI_LOCALES).toEqual(["en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]);
    for (const code of START_UI_LOCALES) {
      const l = getSarvamLocale(code);
      expect(l?.chat && l.tts && l.stt, code).toBe(true);
    }
  });

  it("has a static start dictionary for every non-English locale", () => {
    const generated = START_UI_LOCALES.filter((l) => l !== "en-IN" && l !== "hi-IN");
    expect(Object.keys(START_TRANSLATIONS).sort()).toEqual([...generated].sort());
  });

  it.each(START_UI_LOCALES.filter((l) => l !== "en-IN" && l !== "hi-IN"))("%s start copy has every key with placeholders preserved", (locale) => {
    expectComplete(EN_TEMPLATES, START_TRANSLATIONS[locale], locale);
  });

  it.each(START_UI_LOCALES.filter((l) => l !== "en-IN" && l !== "hi-IN"))("%s Tara call console copy has every key", (locale) => {
    expect(Object.keys(VOICE_TRANSLATIONS)).toContain(locale);
    expectComplete(toTemplates(VOICE_EN, VOICE_COPY_PARAMS), VOICE_TRANSLATIONS[locale], locale);
    const v = voiceUiCopy(locale);
    expect(v.messages(3)).toContain("3");
    expect(v.remove("Sarees")).toContain("Sarees");
    expect(v.agentName.trim().length).toBeGreaterThan(0); // "Tara" may be written in the native script
    expect(v.startConversation).not.toBe(VOICE_EN.startConversation);
  });

  it("voice copy keeps English and Hindi and falls back to English", () => {
    expect(voiceUiCopy("en-IN")).toBe(VOICE_EN);
    expect(voiceUiCopy("xx-IN")).toBe(VOICE_EN);
    expect(voiceUiCopy("hi-IN").send).toBe("भेजें");
  });

  it("hand-written Hindi keeps every placeholder", () => {
    expectComplete(EN_TEMPLATES, toTemplates(startCopy("hi-IN"), START_COPY_PARAMS), "hi-IN");
  });

  it("rebuilds function entries from templates", () => {
    for (const locale of START_UI_LOCALES) {
      const c = startCopy(locale);
      expect(c.account.codeSentTo("a@b.test"), locale).toContain("a@b.test");
      expect(c.quiz.step(2, 5), locale).toMatch(/2[\s\S]*5|5[\s\S]*2/);
      expect(c.lang.continue("Tamil"), locale).toContain("Tamil");
      expect(c.done.subNamed("Kia"), locale).toContain("Kia");
    }
  });

  it("shows translated text, not English, for regional locales", () => {
    for (const locale of ["bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]) {
      expect(startCopy(locale).build.storeDesc, locale).not.toBe(START_EN.build.storeDesc);
    }
  });

  it("falls back to English per key and for unknown locales", () => {
    expect(startCopy("xx-IN")).toBe(startCopy("en-IN"));
    const merged = localize(START_EN, { back: "পিছনে", lang: { continue: "{wrong} →" } }, START_COPY_PARAMS);
    expect(merged.back).toBe("পিছনে");
    expect(merged.voiceOn).toBe(START_EN.voiceOn);
    expect(merged.lang.continue("Bengali")).toBe(START_EN.lang.continue("Bengali"));
    expect(merged.building.steps).toEqual(START_EN.building.steps);
  });

  it("fills named placeholders in any order", () => {
    expect(fillTemplate("{total} में से {n}", ["n", "total"], [2, 5])).toBe("5 में से 2");
  });

  it("has the browser-speech / STT-outage keys in every locale, translated", () => {
    const keys = ["heardLive", "sttUnavailable", "notHeard", "speakNow"] as const;
    for (const locale of START_UI_LOCALES) {
      const v = voiceUiCopy(locale);
      for (const key of keys) {
        expect(v[key].trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        if (locale !== "en-IN") expect(v[key], `${locale}.${key}`).not.toBe(VOICE_EN[key]);
      }
    }
  });
});
