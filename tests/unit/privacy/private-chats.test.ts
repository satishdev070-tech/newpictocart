import { describe, expect, it, vi } from "vitest";
import { TARA_CHAT_IDLE_MS, withoutStaleChat } from "@/features/start/draft/storage";

vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ SARVAM_API_KEY: "k" }) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const { notePossiblePause, sarvamPaused, resetSarvamPauseForTests, synthesizeSpeech, chatTurn } = await import("@/lib/sarvam/client");

describe("Ask Tara history is private to one store + one member", () => {
  it("keys history by panel, store and member", async () => {
    const { storageKey } = await import("@/features/seller-ai/components/copilot/copilot-drawer");
    const a = storageKey("store", "storeA:user1");
    expect(a).toBe("pc-copilot:store:storeA:user1");
    expect(storageKey("store", "storeB:user1")).not.toBe(a);
    expect(storageKey("store", "storeA:user2")).not.toBe(a);
    expect(storageKey("informative", "storeA:user1")).not.toBe(a);
  });
});

describe("onboarding chat on a shared device", () => {
  const draft = JSON.stringify({ screen: "voice", voice: { facts: { name: "Ramesh Fashion" }, turns: [{ role: "seller", text: "hi" }] } });
  const now = 1_000_000_000_000;

  it("keeps the conversation while it's fresh", () => {
    expect(withoutStaleChat(draft, now - 10 * 60 * 1000, now)).toBe(draft);
  });

  it("drops the transcript after 2 hours idle (and on old drafts with no timestamp), keeping the store details", () => {
    for (const savedAt of [now - TARA_CHAT_IDLE_MS - 1, null]) {
      const out = JSON.parse(withoutStaleChat(draft, savedAt, now)!);
      expect(out.voice.turns).toEqual([]);
      expect(out.voice.facts.name).toBe("Ramesh Fashion");
    }
  });

  it("is safe with empty or broken drafts", () => {
    expect(withoutStaleChat(null, null, now)).toBeNull();
    expect(withoutStaleChat("not json", null, now)).toBe("not json");
  });
});

describe("Sarvam circuit breaker", () => {
  it("pauses Sarvam for 10 minutes after a quota/auth error so Tara answers straight from the fallbacks", async () => {
    resetSarvamPauseForTests();
    const t0 = Date.now();
    notePossiblePause("rate_limited", t0);
    expect(sarvamPaused(t0 + 1)).toBe(false);
    notePossiblePause("quota", t0);
    expect(sarvamPaused(t0 + 1)).toBe(true);
    expect(sarvamPaused(t0 + 10 * 60 * 1000 + 1)).toBe(false);
    // While paused: no network call, instant fallbacks.
    notePossiblePause("quota");
    await expect(synthesizeSpeech({ text: "hello", languageCode: "en-IN" })).resolves.toBeNull();
    await expect(chatTurn({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ context: { reason: "sarvam_chat_failed" } });
    resetSarvamPauseForTests();
  });
});
