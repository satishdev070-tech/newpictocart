import { describe, expect, it } from "vitest";
import {
  captionHasText,
  captionReducer,
  captionText,
  classifyRecognitionError,
  emptyCaption,
  pickVoice,
  piecesFromResults,
  primaryLanguage,
  recognitionLang,
  utteranceTimeoutMs,
  type CaptionEvent,
  type VoiceLike,
} from "@/features/onboarding/voice/browser-speech";

const voice = (lang: string, name = lang, extra: Partial<VoiceLike> = {}): VoiceLike => ({
  lang,
  name,
  localService: false,
  default: false,
  ...extra,
});

describe("recognitionLang", () => {
  it("passes the ten Tara locales through as BCP-47 tags", () => {
    for (const l of ["hi-IN", "ta-IN", "bn-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN", "en-IN"]) {
      expect(recognitionLang(l)).toBe(l);
    }
  });
  it("maps Sarvam's Odia code and defaults bad input to en-IN", () => {
    expect(recognitionLang("od-IN")).toBe("or-IN");
    expect(recognitionLang("")).toBe("en-IN");
    expect(recognitionLang(null)).toBe("en-IN");
    expect(recognitionLang("hindi")).toBe("en-IN");
  });
  it("primaryLanguage handles Android-style tags", () => {
    expect(primaryLanguage("hi_IN")).toBe("hi");
    expect(primaryLanguage("EN-us")).toBe("en");
  });
});

describe("pickVoice", () => {
  it("prefers the exact locale, then same language in India, then same language anywhere", () => {
    const voices = [voice("en-US"), voice("hi-XX", "far"), voice("hi_IN", "android"), voice("en-IN")];
    expect(pickVoice(voices, "hi-IN")?.name).toBe("android");
    expect(pickVoice([voice("en-US"), voice("hi-XX", "far")], "hi-IN")?.name).toBe("far");
    expect(pickVoice(voices, "en-IN")?.lang).toBe("en-IN");
    expect(pickVoice([voice("en-GB", "gb"), voice("en-US", "us", { default: true })], "en-IN")?.name).toBe("us");
  });
  it("prefers an on-device voice among equals", () => {
    const voices = [voice("ta-IN", "cloud"), voice("ta-IN", "local", { localService: true })];
    expect(pickVoice(voices, "ta-IN")?.name).toBe("local");
  });
  it("returns null when no voice speaks the language (never reads Hindi in English)", () => {
    expect(pickVoice([voice("en-US"), voice("en-IN")], "hi-IN")).toBeNull();
    expect(pickVoice([], "en-IN")).toBeNull();
  });
});

describe("caption reducer", () => {
  const run = (events: CaptionEvent[]) => events.reduce(captionReducer, emptyCaption);

  it("shows interim text live and replaces it as results update", () => {
    let s = run([{ type: "results", pieces: [{ text: "meri", isFinal: false }] }]);
    expect(captionText(s)).toBe("meri");
    s = captionReducer(s, { type: "results", pieces: [{ text: "meri dukaan", isFinal: false }] });
    expect(captionText(s)).toBe("meri dukaan");
    expect(s.interim).toBe("meri dukaan");
    s = captionReducer(s, { type: "results", pieces: [{ text: "meri dukaan ka naam", isFinal: true }] });
    expect(s).toEqual({ committed: "", final: "meri dukaan ka naam", interim: "" });
  });

  it("keeps earlier sessions of the same turn and appends the next one", () => {
    const s = run([
      { type: "results", pieces: [{ text: "Aangan Crafts", isFinal: true }] },
      { type: "session-end" },
      { type: "results", pieces: [{ text: "in Jaipur", isFinal: false }] },
    ]);
    expect(captionText(s)).toBe("Aangan Crafts in Jaipur");
    expect(s.committed).toBe("Aangan Crafts");
  });

  it("keeps leftover interim text when a session ends without a final result", () => {
    const s = run([{ type: "results", pieces: [{ text: "sarees", isFinal: false }] }, { type: "session-end" }]);
    expect(s.committed).toBe("sarees");
    expect(captionHasText(s)).toBe(true);
  });

  it("joins several result pieces and trims whitespace", () => {
    const s = run([
      {
        type: "results",
        pieces: [
          { text: " handmade ", isFinal: true },
          { text: "pottery", isFinal: true },
          { text: " and", isFinal: false },
        ],
      },
    ]);
    expect(captionText(s)).toBe("handmade pottery and");
  });

  it("returns the same object when nothing changed, and resets to empty", () => {
    const s = run([{ type: "results", pieces: [{ text: "a", isFinal: false }] }]);
    expect(captionReducer(s, { type: "results", pieces: [{ text: "a", isFinal: false }] })).toBe(s);
    expect(captionReducer(emptyCaption, { type: "session-end" })).toBe(emptyCaption);
    expect(captionReducer(s, { type: "reset" })).toBe(emptyCaption);
    expect(captionHasText(emptyCaption)).toBe(false);
  });

  it("reads a DOM-shaped results list", () => {
    const results = [Object.assign([{ transcript: "hello" }], { isFinal: true }), Object.assign([{ transcript: "there" }], { isFinal: false })];
    expect(piecesFromResults(results)).toEqual([
      { text: "hello", isFinal: true },
      { text: "there", isFinal: false },
    ]);
  });
});

describe("recognition errors", () => {
  it("classifies engine errors into retry / blocked / fallback / ignore", () => {
    expect(classifyRecognitionError("no-speech")).toBe("retry");
    expect(classifyRecognitionError("aborted")).toBe("ignore");
    expect(classifyRecognitionError("not-allowed")).toBe("blocked");
    expect(classifyRecognitionError("service-not-allowed")).toBe("blocked");
    for (const e of ["network", "language-not-supported", "audio-capture", "something-new"]) {
      expect(classifyRecognitionError(e)).toBe("fallback");
    }
  });
  it("gives long utterances more time before the safety timeout", () => {
    expect(utteranceTimeoutMs("hi")).toBeLessThan(utteranceTimeoutMs("a much longer reply ".repeat(10)));
    expect(utteranceTimeoutMs("x".repeat(10_000))).toBe(60_000);
  });
});
