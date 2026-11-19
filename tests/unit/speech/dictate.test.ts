import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DICTATE_IDLE_MS, dictate } from "@/lib/speech/browser-speech";

/** Fake Web Speech engine: each instance is one session; tests drive results/end by hand. */
class FakeRec {
  static all: FakeRec[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: { resultIndex: number; results: unknown }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRec.all.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
  say(...pieces: [string, boolean][]) {
    const results = pieces.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }));
    this.onresult?.({ resultIndex: 0, results });
  }
  end(error?: string) {
    if (error) this.onerror?.({ error });
    this.onend?.();
  }
}
const last = () => FakeRec.all[FakeRec.all.length - 1]!;

describe("dictate: listens until Stop", () => {
  beforeEach(() => {
    FakeRec.all = [];
    vi.useFakeTimers();
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRec });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh) Chrome/130" });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps everything said across engine pauses and finishes only on stop()", () => {
    const interim: string[] = [];
    const onFinal = vi.fn();
    const h = dictate("hi-IN", { onInterim: (t) => interim.push(t), onFinal, onError: vi.fn() })!;
    expect(last().continuous).toBe(true);
    expect(last().lang).toBe("hi-IN");
    last().say(["Blue Kurti ka stock", true]);
    last().end(); // the browser ended the session after a pause
    expect(onFinal).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers(); // restarted
    expect(FakeRec.all).toHaveLength(2);
    last().say(["50 kar do", false]);
    expect(interim.at(-1)).toBe("Blue Kurti ka stock 50 kar do");
    last().end("no-speech"); // silence: still listening
    vi.runOnlyPendingTimers();
    expect(onFinal).not.toHaveBeenCalled();
    h.stop();
    expect(onFinal).toHaveBeenCalledWith("Blue Kurti ka stock 50 kar do");
    expect(onFinal).toHaveBeenCalledTimes(1);
  });

  it("Android: one-shot sessions (no repeated text), still joined", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" });
    const onFinal = vi.fn();
    const h = dictate("en-IN", { onInterim: vi.fn(), onFinal, onError: vi.fn() })!;
    expect(last().continuous).toBe(false);
    last().say(["set price", true]);
    last().end();
    vi.runOnlyPendingTimers();
    last().say(["to 499", true]);
    h.stop();
    expect(onFinal).toHaveBeenCalledWith("set price to 499");
  });

  it("ends itself after a long silence, and reports a blocked mic", () => {
    const onFinal = vi.fn();
    dictate("en-IN", { onInterim: vi.fn(), onFinal, onError: vi.fn() });
    last().say(["hello", true]);
    vi.advanceTimersByTime(DICTATE_IDLE_MS + 1);
    last().end("no-speech");
    expect(onFinal).toHaveBeenCalledWith("hello");

    const onError = vi.fn();
    dictate("en-IN", { onInterim: vi.fn(), onFinal: vi.fn(), onError });
    last().end("not-allowed");
    expect(onError).toHaveBeenCalledWith("not-allowed");
  });

  it("a network error after words keeps the words", () => {
    const onFinal = vi.fn();
    const onError = vi.fn();
    dictate("en-IN", { onInterim: vi.fn(), onFinal, onError });
    last().say(["add 20 mugs", true]);
    last().end("network");
    expect(onFinal).toHaveBeenCalledWith("add 20 mugs");
    expect(onError).not.toHaveBeenCalled();
  });
});
