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
import { EMPTY_FACTS } from "@/features/onboarding/voice/facts";
import { cityAlreadyAsked, nextOfflineStep, offlineReply } from "@/features/onboarding/voice/offline-replies";
import { SARVAM_CHAT_TTS_CODES } from "@/lib/sarvam/locales";
import { AppError } from "@/lib/errors";

describe("Tara without the AI chat (Sarvam outage / no credits)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sarvam.chatTurn.mockRejectedValue(new AppError("VALIDATION", { context: { reason: "sarvam_chat_failed" } }));
  });

  it("keeps the conversation going with local extraction and a scripted next question", async () => {
    const out = await runTaraTurn({ locale: "en-IN", facts: { ...EMPTY_FACTS }, text: "My store is called Kia Jewels. I sell fashion jewellery and bridal sets in Noida." });
    expect(out.heard).toBe(true);
    expect(out.userText).toContain("Kia Jewels");
    expect(out.facts.categories).toContain("jewellery");
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.audioBase64).toBeNull();
    expect(sarvam.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("asks for the next missing fact in quiz order", () => {
    expect(nextOfflineStep({ ...EMPTY_FACTS }, false)).toBe("name");
    expect(nextOfflineStep({ ...EMPTY_FACTS, name: "Kia" }, false)).toBe("category");
    expect(nextOfflineStep({ ...EMPTY_FACTS, name: "Kia", categories: ["jewellery"], category: "jewellery" }, false)).toBe("products");
    const filled = { ...EMPTY_FACTS, name: "Kia", categories: ["jewellery" as const], category: "jewellery" as const, subcategories: ["bridal"], subcategory: "bridal" };
    expect(nextOfflineStep(filled, false)).toBe("city");
    expect(nextOfflineStep(filled, true)).toBe("ready");
  });

  it("has a line for every step in every chat locale and detects an earlier city question", () => {
    for (const locale of SARVAM_CHAT_TTS_CODES) {
      for (const step of ["name", "category", "products", "city", "ready"] as const) expect(offlineReply(locale, step).length).toBeGreaterThan(5);
    }
    expect(cityAlreadyAsked([{ role: "tara", text: offlineReply("ta-IN", "city") }])).toBe(true);
    expect(cityAlreadyAsked([{ role: "seller", text: "Noida" }])).toBe(false);
  });
});
