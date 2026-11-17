import { beforeEach, describe, expect, it, vi } from "vitest";

const sarvam = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  chatTurn: vi.fn(),
  synthesizeSpeech: vi.fn(),
  isSarvamConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/sarvam/client", async (orig) => ({ ...(await orig<object>()), ...sarvam }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { runTaraTurn } from "@/features/onboarding/voice/turn";
import { EMPTY_FACTS, type VoiceFacts } from "@/features/onboarding/voice/facts";
import { cleanAnswer, fillExpectedSlot, isNonAnswer } from "@/features/onboarding/voice/slot-fill";
import { offlineReply } from "@/features/onboarding/voice/offline-replies";
import { AppError } from "@/lib/errors";

type Turn = { role: "seller" | "tara"; text: string };

/** Drive the offline conversation like the client does (facts + history carried over). */
async function talk(locale: "hi-IN" | "en-IN", answers: string[]) {
  let facts: VoiceFacts = { ...EMPTY_FACTS };
  const history: Turn[] = [{ role: "tara", text: "नमस्ते! … आपके स्टोर का नाम क्या है?" }];
  const replies: string[] = [];
  for (const text of answers) {
    const out = await runTaraTurn({ locale, facts, text, history: [...history] });
    facts = out.facts as VoiceFacts;
    history.push({ role: "seller", text }, { role: "tara", text: out.reply });
    replies.push(out.reply);
  }
  return { facts, replies };
}

describe("Tara offline slot filling (owner screenshot 2026-11-17: same question asked again and again)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sarvam.chatTurn.mockRejectedValue(new AppError("VALIDATION", { context: { reason: "sarvam_chat_failed" } }));
    sarvam.synthesizeSpeech.mockResolvedValue(null);
  });

  it("takes a bare answer as the store name and moves on", async () => {
    const { facts, replies } = await talk("hi-IN", ["विनोद जनरल स्टोर"]);
    expect(facts.name).toBe("विनोद जनरल स्टोर");
    expect(replies[0]).toBe(offlineReply("hi-IN", "category"));
  });

  it("does not store a complaint as the name, and rephrases instead of repeating", async () => {
    const { facts, replies } = await talk("hi-IN", ["अरे बताया तो अभी", "विनोद"]);
    expect(replies[0]).toBe(offlineReply("hi-IN", "name"));
    expect(facts.name).toBe("विनोद");
    expect(new Set(replies).size).toBe(replies.length);
  });

  it("completes the whole conversation from short Hindi answers", async () => {
    const { facts, replies } = await talk("hi-IN", ["विनोद जनरल स्टोर", "किराना", "चावल, दाल और मसाले", "नोएडा"]);
    expect(facts).toMatchObject({ name: "विनोद जनरल स्टोर", category: "grocery", city: expect.stringMatching(/नोएडा|Noida/) });
    expect(facts.subcategories.length).toBeGreaterThan(0);
    expect(replies.at(-1)).toBe(offlineReply("hi-IN", "ready"));
  });

  it("never asks the same line twice in a row", async () => {
    const { replies } = await talk("en-IN", ["what?", "what?", "Kia Jewels"]);
    for (let i = 1; i < replies.length; i++) expect(replies[i]).not.toBe(replies[i - 1]);
  });

  it("lets the seller skip the city", async () => {
    const { replies } = await talk("en-IN", ["Kia Jewels", "jewellery", "bridal sets", "skip"]);
    expect(replies.at(-1)).toBe(offlineReply("en-IN", "ready"));
  });
});

describe("slot-fill helpers", () => {
  it("strips filler around names", () => {
    expect(cleanAnswer("मेरी दुकान का नाम विनोद जनरल स्टोर है।")).toBe("विनोद जनरल स्टोर");
    expect(cleanAnswer("It's called Kia Jewels.")).toBe("Kia Jewels");
    expect(cleanAnswer("Meri dukaan ka naam Vinod Store hai")).toBe("Vinod Store");
  });
  it("detects non-answers", () => {
    expect(isNonAnswer("अरे बताया तो अभी")).toBe(true);
    expect(isNonAnswer("I already told you")).toBe(true);
    expect(isNonAnswer("Vinod General Store")).toBe(false);
  });
  it("maps an unknown shop type to General with the seller's words kept", () => {
    const p = fillExpectedSlot("category", "handmade candles", { ...EMPTY_FACTS, name: "Glow" });
    expect(p.categories?.[0]).toBeTruthy();
    expect(p.subcategories?.length).toBe(1);
  });
});
