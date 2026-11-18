import { describe, expect, it } from "vitest";
import { voiceGenderScore } from "@/lib/speech/voice-gender";
import { pickVoice } from "@/lib/speech/browser-speech";
import { pickVoice as pickTaraVoice } from "@/features/onboarding/voice/browser-speech";
import { STRIP_LINKER_PARAM } from "@/features/marketing-site/components/platform-analytics";

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("female voice preference", () => {
  it("reads gender from common voice names", () => {
    for (const n of ["Lekha", "Veena", "Microsoft Swara Online (Natural) - Hindi (India)", "Microsoft Heera - English (India)", "Google UK English Female", "Google हिन्दी"]) {
      expect(voiceGenderScore(n)).toBeGreaterThan(0);
    }
    for (const n of ["Rishi", "Microsoft Ravi - English (India)", "Microsoft Madhur Online (Natural) - Hindi (India)", "Google UK English Male", "Daniel"]) {
      expect(voiceGenderScore(n)).toBeLessThan(0);
    }
    expect(voiceGenderScore("Unknown Voice")).toBe(0);
  });

  it("assistant picker: female voice for the locale, never the wrong language", () => {
    const voices = [v("Rishi", "en-IN"), v("Veena", "en-IN"), v("Samantha", "en-US"), v("Microsoft Madhur", "hi-IN"), v("Lekha", "hi-IN")];
    expect(pickVoice(voices, "en-IN")?.name).toBe("Veena");
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Lekha");
    // Female everywhere: a female voice of another region beats an Indian male voice…
    expect(pickVoice([v("Rishi", "en-IN"), v("Samantha", "en-US")], "en-IN")?.name).toBe("Samantha");
    // …but the Indian female voice beats every other female voice.
    expect(pickVoice([v("Samantha", "en-US"), v("Veena", "en-IN"), v("Karen", "en-AU")], "en-IN")?.name).toBe("Veena");
    // With only male voices, the Indian one.
    expect(pickVoice([v("Daniel", "en-GB"), v("Rishi", "en-IN")], "en-IN")?.name).toBe("Rishi");
    expect(pickVoice([v("Samantha", "en-US")], "ta-IN")).toBeNull();
  });

  it("Tara's picker prefers a female voice too", () => {
    expect(pickTaraVoice([v("Microsoft Madhur", "hi-IN"), v("Microsoft Swara", "hi-IN")], "hi-IN")?.name).toBe("Microsoft Swara");
    expect(pickTaraVoice([v("Rishi", "en-IN"), v("Veena", "en-IN")], "en-IN")?.name).toBe("Veena");
    expect(pickTaraVoice([v("Rishi", "en-IN"), v("Samantha", "en-US")], "en-IN")?.name).toBe("Samantha");
    expect(pickTaraVoice([v("Samantha", "en-US")], "hi-IN")).toBeNull();
  });
});

describe("GA linker suffix removal", () => {
  type Listener = (e: { target: unknown }) => void;
  function run(href: string, event = "click") {
    const listeners: Record<string, Listener> = {};
    const a = { href, closest: () => a };
    const doc = { addEventListener: (t: string, f: Listener) => (listeners[t] = f) };
    const win: Record<string, unknown> = {};
    new Function("window", "document", "URL", STRIP_LINKER_PARAM)(win, doc, URL);
    listeners[event]?.({ target: a });
    return { a, listeners };
  }

  it("strips _gl from a store link and keeps everything else", () => {
    expect(run("https://sravan-ro-service.pictocart.in/?_gl=1*1soafqz*_ga*ODky").a.href).toBe("https://sravan-ro-service.pictocart.in/");
    expect(run("https://shop.pictocart.in/products?x=1&_gl=1*abc").a.href).toBe("https://shop.pictocart.in/products?x=1");
    expect(run("https://shop.pictocart.in/?_gl=1*abc", "auxclick").a.href).toBe("https://shop.pictocart.in/");
    expect(run("https://shop.pictocart.in/?q=1").a.href).toBe("https://shop.pictocart.in/?q=1");
  });

  it("installs its listeners once", () => {
    const listeners: string[] = [];
    const doc = { addEventListener: (t: string) => listeners.push(t) };
    const win: Record<string, unknown> = {};
    const f = new Function("window", "document", "URL", STRIP_LINKER_PARAM);
    f(win, doc, URL);
    f(win, doc, URL);
    expect(listeners).toEqual(["click", "auxclick", "contextmenu"]);
  });
});
