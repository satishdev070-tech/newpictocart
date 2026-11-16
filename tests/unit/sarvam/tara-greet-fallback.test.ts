import { beforeEach, describe, expect, it, vi } from "vitest";

const sarvam = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
  isSarvamConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/sarvam/client", () => sarvam);

import { taraSpokenGreeting } from "@/features/onboarding/voice/greet";
import { taraGreetingText } from "@/features/onboarding/voice/greetings";

describe("Tara greeting without TTS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the text with null audio when TTS rejects (browser speaks it)", async () => {
    sarvam.synthesizeSpeech.mockRejectedValueOnce(new Error("402 No credits"));
    await expect(taraSpokenGreeting("ta-IN", "welcome")).resolves.toEqual({
      text: taraGreetingText("ta-IN", "welcome"),
      audioBase64: null,
      mimeType: null,
    });
  });

  it("returns the text with null audio when TTS gives nothing, and retries next time", async () => {
    sarvam.synthesizeSpeech.mockResolvedValue(null);
    const a = await taraSpokenGreeting("bn-IN", "resume");
    expect(a.audioBase64).toBeNull();
    expect(a.text).toBe(taraGreetingText("bn-IN", "resume"));
    await taraSpokenGreeting("bn-IN", "resume");
    expect(sarvam.synthesizeSpeech).toHaveBeenCalledTimes(2);
  });

  it("skips TTS entirely when Sarvam is not configured", async () => {
    sarvam.isSarvamConfigured.mockReturnValueOnce(false);
    const line = await taraSpokenGreeting("en-IN");
    expect(line.audioBase64).toBeNull();
    expect(sarvam.synthesizeSpeech).not.toHaveBeenCalled();
  });
});
