import { beforeEach, describe, expect, it, vi } from "vitest";
import { callReducer, initialCallMachine, type CallMachine } from "@/features/onboarding/voice/call-machine";
import { taraSystemPrompt } from "@/features/onboarding/voice/prompt";
import { pickVoice as pickTaraVoice } from "@/features/onboarding/voice/browser-speech";
import { EMPTY_FACTS } from "@/features/onboarding/voice/facts";

const sarvam = vi.hoisted(() => ({ configured: true, chat: vi.fn() }));
const llm = vi.hoisted(() => ({ providers: [] as { id: string; apiKey: string; model: string }[], generate: vi.fn() }));
vi.mock("@/lib/sarvam/client", () => ({ isSarvamConfigured: () => sarvam.configured, chatTurn: sarvam.chat }));
vi.mock("@/features/neural-pulse/server/generate", () => ({ loadProviders: async () => llm.providers }));
vi.mock("@/features/neural-pulse/server/llm", () => ({ generateJson: llm.generate }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { thinkAsTara, orderForVoice } = await import("@/features/onboarding/voice/brain");

const listening = (): CallMachine => ({ ...initialCallMachine, phase: "listening", listener: "browser" });

describe("Tara call: review before sending", () => {
  it("listening → reviewing (mic off) → send → thinking", () => {
    const r = callReducer(listening(), { type: "REVIEW" });
    expect(r.phase).toBe("reviewing");
    const sent = callReducer(r, { type: "REVIEW_SEND" });
    expect(sent.phase).toBe("thinking");
    expect(sent.endReason).toBe("speech");
  });

  it("say it again re-opens a fresh take", () => {
    const r = callReducer(listening(), { type: "REVIEW" });
    const again = callReducer(r, { type: "RETAKE" });
    expect(again.phase).toBe("listening");
    expect(again.takeId).toBe(r.takeId + 1);
  });

  it("typing while reviewing sends the typed text instead", () => {
    const r = callReducer(listening(), { type: "REVIEW" });
    expect(callReducer(r, { type: "TEXT_SENT" }).phase).toBe("thinking");
  });

  it("ignores review events in other phases", () => {
    const speaking: CallMachine = { ...initialCallMachine, phase: "speaking", listener: "browser" };
    expect(callReducer(speaking, { type: "REVIEW" })).toBe(speaking);
    expect(callReducer(speaking, { type: "REVIEW_SEND" })).toBe(speaking);
    expect(callReducer(speaking, { type: "RETAKE" })).toBe(speaking);
    const recorder: CallMachine = { ...initialCallMachine, phase: "listening", listener: "recorder" };
    expect(callReducer(recorder, { type: "REVIEW" })).toBe(recorder);
  });
});

describe("Tara's brain: Sarvam → platform AI → scripted", () => {
  const input = { locale: "hi-IN" as const, transcript: "mera naam Ramesh hai, kapde bechta hoon", facts: { ...EMPTY_FACTS } };
  beforeEach(() => {
    sarvam.configured = true;
    sarvam.chat.mockReset();
    llm.generate.mockReset();
    llm.providers = [
      { id: "nvidia", apiKey: "k", model: "m" },
      { id: "gemini", apiKey: "k", model: "m" },
      { id: "groq", apiKey: "k", model: "m" },
    ];
  });

  it("uses Sarvam chat when it works", async () => {
    sarvam.chat.mockResolvedValue({ content: '{"reply":"ok","facts":{},"done":false}' });
    expect((await thinkAsTara(input)).via).toBe("sarvam");
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it("falls back to the platform AI (fast models first, native language) when Sarvam fails", async () => {
    sarvam.chat.mockRejectedValue(new Error("402 no credits"));
    llm.generate.mockResolvedValue({ data: { reply: "Ramesh ji, badhiya!", facts: {}, done: false }, provider: "groq", model: "m", tokens: 10, attempts: 1 });
    const r = await thinkAsTara(input);
    expect(r.via).toBe("groq");
    expect(JSON.parse(r.content).reply).toBe("Ramesh ji, badhiya!");
    const [providers, prompt] = llm.generate.mock.calls[0]!;
    expect(providers.map((p: { id: string }) => p.id)).toEqual(["groq", "gemini", "nvidia"]);
    expect(prompt.system).toContain("Reply to the seller in Hindi");
  });

  it("throws when no brain is available, so the caller uses scripted questions", async () => {
    sarvam.chat.mockRejectedValue(new Error("down"));
    llm.generate.mockRejectedValue(new Error("all providers failed"));
    await expect(thinkAsTara(input)).rejects.toThrow();
    llm.providers = [];
    await expect(thinkAsTara(input)).rejects.toThrow();
  });

  it("orders providers for low latency", () => {
    expect(orderForVoice([{ id: "anthropic", apiKey: "", model: "" }, { id: "nvidia", apiKey: "", model: "" }, { id: "groq", apiKey: "", model: "" }] as never).map((p) => p.id)).toEqual(["groq", "anthropic", "nvidia"]);
  });
});

describe("Tara's persona prompt", () => {
  it("is a warm Indian woman who listens, reacts, asks one question and offers examples", () => {
    const p = taraSystemPrompt("en-IN");
    expect(p).toMatch(/You are Tara/);
    expect(p).toMatch(/Indian woman/);
    expect(p).toMatch(/exactly ONE question/);
    expect(p).toMatch(/2-3 concrete examples/);
    expect(p).toMatch(/correct you/);
    expect(p).toMatch(/Examples of good turns/);
    // The server-side contract is still there.
    expect(p).toMatch(/siteMode \\?"ecommerce\\?"/);
    expect(p).toMatch(/"done": true only when/);
  });

  it("replies natively when the platform AI is the brain", () => {
    expect(taraSystemPrompt("ta-IN", { nativeReply: true })).toMatch(/Reply to the seller in Tamil/);
  });
});

describe("Tara's voice on male-only devices", () => {
  it("still speaks (with the best male voice) instead of going silent", () => {
    const v = (name: string, lang: string) => ({ name, lang, localService: true, default: false }) as SpeechSynthesisVoice;
    expect(pickTaraVoice([v("Rishi", "en-IN"), v("Daniel", "en-GB")], "en-IN")?.name).toBe("Rishi");
  });
});
