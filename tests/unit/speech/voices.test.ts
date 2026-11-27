import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseVoice, parseVoicePrefs, rankVoices, speakPieces, speechChunks, voiceQualityScore } from "@/lib/speech/voices";

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("device voice ranking", () => {
  it("scores natural / online / Google voices above old offline engines", () => {
    expect(voiceQualityScore("Microsoft Swara Online (Natural) - Hindi (India)")).toBeGreaterThan(voiceQualityScore("Microsoft Kalpana - Hindi (India)"));
    expect(voiceQualityScore("Google हिन्दी")).toBeGreaterThan(voiceQualityScore("Lekha"));
    expect(voiceQualityScore("Veena (Enhanced)")).toBeGreaterThan(voiceQualityScore("Veena"));
    expect(voiceQualityScore("eSpeak Hindi")).toBeLessThan(0);
  });

  it("picks the natural voice among same-language female voices, even when it is online", () => {
    const voices = [v("Microsoft Kalpana - Hindi (India)", "hi-IN"), v("Microsoft Swara Online (Natural) - Hindi (India)", "hi-IN", false)];
    expect(chooseVoice(voices, "hi-IN")?.name).toContain("Swara");
    expect(chooseVoice([v("Lekha", "hi-IN"), v("Google हिन्दी", "hi-IN", false)], "hi-IN")?.name).toBe("Google हिन्दी");
  });

  it("never trades the language, the Indian region or a female voice for quality", () => {
    expect(chooseVoice([v("Google US English", "en-US", false), v("Veena", "en-IN")], "en-IN")?.name).toBe("Veena");
    expect(chooseVoice([v("Microsoft Prabhat Online (Natural)", "en-IN", false), v("Microsoft Heera", "en-IN")], "en-IN")?.name).toBe("Microsoft Heera");
    expect(chooseVoice([v("Google UK English Female", "en-GB")], "hi-IN")).toBeNull();
    // macOS joke voices are never offered.
    expect(rankVoices([v("Bubbles", "en-US"), v("Bad News", "en-US"), v("Rishi", "en-IN")], "en-IN").map((r) => r.voice.name)).toEqual(["Rishi"]);
  });

  it("uses the seller's saved voice when this device has it, else the best", () => {
    const voices = [v("Lekha", "hi-IN"), v("Google हिन्दी", "hi-IN", false), v("Microsoft Madhur", "hi-IN")];
    expect(chooseVoice(voices, "hi-IN", "Microsoft Madhur")?.name).toBe("Microsoft Madhur");
    expect(chooseVoice(voices, "hi-IN", "Gone Voice")?.name).toBe("Google हिन्दी");
    // A saved voice of another language is ignored.
    expect(chooseVoice([...voices, v("Samantha", "en-US")], "hi-IN", "Samantha")?.name).toBe("Google हिन्दी");
    expect(rankVoices(voices, "hi-IN").map((r) => r.voice.name)[0]).toBe("Google हिन्दी");
  });
});

describe("voice preferences", () => {
  it("parses stored prefs defensively", () => {
    expect(parseVoicePrefs(null)).toEqual({ voices: {}, speed: "normal" });
    expect(parseVoicePrefs("not json")).toEqual({ voices: {}, speed: "normal" });
    expect(parseVoicePrefs(JSON.stringify({ voices: { hi: "Lekha", "bad key": "x", en: 5 }, speed: "fast" }))).toEqual({ voices: { hi: "Lekha" }, speed: "fast" });
    expect(parseVoicePrefs(JSON.stringify({ speed: "warp" })).speed).toBe("normal");
  });
});

describe("speechChunks", () => {
  it("splits on sentence ends (including ।) and new lines", () => {
    expect(speechChunks("Done. Stock is 50!\nAnything else?")).toEqual(["Done.", "Stock is 50!", "Anything else?"]);
    expect(speechChunks("ठीक है। स्टॉक 50 कर दिया।")).toEqual(["ठीक है।", "स्टॉक 50 कर दिया।"]);
    expect(speechChunks("   ")).toEqual([]);
  });
  it("breaks a very long sentence near commas or spaces, losing nothing", () => {
    const long = Array.from({ length: 40 }, (_, i) => `item ${i}`).join(", ");
    const parts = speechChunks(long, 60);
    expect(parts.every((p) => p.length <= 60)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
  });
});

describe("speakPieces", () => {
  afterEach(() => vi.unstubAllGlobals());

  class Utter {
    text: string;
    lang = "";
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(t: string) {
      this.text = t;
    }
  }

  it("speaks every piece in order at the given rate, and stops on cancel", async () => {
    vi.stubGlobal("SpeechSynthesisUtterance", Utter);
    const spoken: Utter[] = [];
    const synth = {
      cancel: vi.fn(),
      speak: (u: Utter) => {
        spoken.push(u);
        queueMicrotask(() => u.onend?.());
      },
    } as unknown as SpeechSynthesis;
    const ok = await speakPieces(synth, "One. Two. Three.", null, "en-IN", { rate: 0.85 });
    expect(ok).toBe(true);
    expect(spoken.map((u) => u.text)).toEqual(["One.", "Two.", "Three."]);
    expect(spoken.every((u) => u.rate === 0.85 && u.lang === "en-IN")).toBe(true);

    let cancel: (() => void) | null = null;
    const held: Utter[] = [];
    const slow = { cancel: vi.fn(), speak: (u: Utter) => held.push(u) } as unknown as SpeechSynthesis;
    const p = speakPieces(slow, "One. Two.", null, "en-IN", { rate: 1, register: (c) => (cancel = c) });
    cancel!();
    expect(await p).toBe(false);
    expect(held).toHaveLength(1);
  });
});
