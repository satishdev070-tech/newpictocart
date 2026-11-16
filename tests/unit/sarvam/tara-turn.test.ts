import { beforeEach, describe, expect, it, vi } from "vitest";

const sarvam = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  chatTurn: vi.fn(),
  synthesizeSpeech: vi.fn(),
  isSarvamConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/sarvam/client", () => sarvam);
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { runTaraTurn } from "@/features/onboarding/voice/turn";
import { EMPTY_FACTS, mergeFacts } from "@/features/onboarding/voice/facts";

const audio = () => new File([new Uint8Array(2000)], "turn.webm", { type: "audio/webm" });

describe("runTaraTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sarvam.synthesizeSpeech.mockResolvedValue(null);
  });

  it("returns the STT text as userText and maps list facts", async () => {
    sarvam.transcribeAudio.mockResolvedValue({ transcript: "I sell fashion jewellery and bridal sets in Noida", detectedLanguage: "en-IN" });
    sarvam.chatTurn.mockResolvedValue({
      content: JSON.stringify({
        reply: "Lovely! Shall we continue?",
        facts: { categories: ["jewellery"], subcategories: ["imitation", "Bridal sets"], city: "Noida" },
        done: false,
      }),
    });
    const out = await runTaraTurn({ locale: "en-IN", facts: { ...EMPTY_FACTS, name: "Glow Box" }, audio: audio() });
    expect(out.heard).toBe(true);
    expect(out.userText).toBe("I sell fashion jewellery and bridal sets in Noida");
    expect(out.transcript).toBe(out.userText);
    expect(out.facts).toMatchObject({
      name: "Glow Box",
      category: "jewellery",
      categories: ["jewellery"],
      subcategories: ["imitation", "bridal"],
      city: "Noida",
    });
    expect(out.done).toBe(true);
  });

  it("reports heard:false without calling chat when STT is empty", async () => {
    sarvam.transcribeAudio.mockResolvedValue({ transcript: "", detectedLanguage: null });
    const out = await runTaraTurn({ locale: "en-IN", facts: EMPTY_FACTS, audio: audio() });
    expect(out).toMatchObject({ heard: false, userText: "", reply: "" });
    expect(sarvam.chatTurn).not.toHaveBeenCalled();
  });

  it("lets Tara's full lists replace earlier ones (corrections stick)", async () => {
    sarvam.chatTurn.mockResolvedValue({
      content: JSON.stringify({ reply: "Got it, only jewellery.", facts: { categories: ["jewellery"], subcategories: ["gold"] } }),
    });
    const prev = mergeFacts(EMPTY_FACTS, { name: "Glow Box", categories: ["fashion", "jewellery"], subcategories: ["ethnic", "silver"] });
    const out = await runTaraTurn({ locale: "en-IN", facts: prev, text: "No clothes, just gold jewellery" });
    expect(out.facts.categories).toEqual(["jewellery"]);
    expect(out.facts.subcategories).toEqual(["gold"]);
  });

  it("falls back to local extraction when Tara's JSON is unreadable", async () => {
    sarvam.chatTurn.mockResolvedValue({ content: "Sounds great!" });
    const out = await runTaraTurn({ locale: "en-IN", facts: EMPTY_FACTS, text: "We sell ethnic wear and skincare" });
    expect(out.reply).toBe("Sounds great!");
    expect(out.facts.categories).toEqual(["fashion", "beauty"]);
  });

  it("fills facts the model missed from the seller's own words (Hinglish)", async () => {
    sarvam.chatTurn.mockResolvedValue({
      content: JSON.stringify({ reply: "Bahut badhiya! Aap kaun se gehne bechte hain?", facts: { categories: [], subcategories: [] } }),
    });
    const out = await runTaraTurn({ locale: "hi-IN", facts: EMPTY_FACTS, text: "Mere store ka naam Kia Javels hai. Main kapde aur gehne bechti hoon" });
    expect(out.facts.name).toBe("Kia Javels");
    expect(out.facts.categories).toEqual(["fashion", "jewellery"]);
  });
});
