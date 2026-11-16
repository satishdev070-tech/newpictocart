import { describe, expect, it } from "vitest";
import {
  VAD,
  callReducer,
  callUiState,
  initialCallMachine,
  type CallEvent,
  type CallMachine,
} from "@/features/onboarding/voice/call-machine";

const run = (events: CallEvent[], from: CallMachine = initialCallMachine) => events.reduce(callReducer, from);
const LOUD = 0.2;
const QUIET = 0.001;
/** `ms` of frames at `level`, 20 ms each. */
const frames = (level: number, ms: number): CallEvent[] =>
  Array.from({ length: Math.ceil(ms / 20) }, () => ({ type: "FRAME" as const, level, dtMs: 20 }));

/** Call that has greeted and is listening. */
const listening = () => run([{ type: "START" }, { type: "MIC_READY" }, { type: "REPLY_READY", speak: true }, { type: "SPEAK_END" }]);

describe("Tara call machine", () => {
  it("starts: connecting → thinking (welcome) → speaking → listening", () => {
    let s = run([{ type: "START" }]);
    expect(s.phase).toBe("connecting");
    expect(callUiState(s)).toBe("thinking");
    s = callReducer(s, { type: "MIC_READY" });
    expect(s.phase).toBe("thinking");
    s = callReducer(s, { type: "REPLY_READY", speak: true });
    expect(s.phase).toBe("speaking");
    const before = s.takeId;
    s = callReducer(s, { type: "SPEAK_END" });
    expect(s.phase).toBe("listening");
    expect(s.takeId).toBe(before + 1);
  });

  it("goes straight to listening when the line is not spoken", () => {
    const s = run([{ type: "START" }, { type: "MIC_READY" }, { type: "REPLY_READY", speak: false }]);
    expect(s.phase).toBe("listening");
  });

  it("falls back to typing when the mic is denied", () => {
    const s = run([{ type: "START" }, { type: "MIC_FAILED", reason: "denied" }]);
    expect(s.phase).toBe("ended");
    expect(s.micFailure).toBe("denied");
  });

  it("ends the turn after ~1.6 s of silence once real speech was heard", () => {
    let s = run(frames(LOUD, 1200), listening());
    expect(s.phase).toBe("listening");
    s = run(frames(QUIET, VAD.silenceMs - 100), s);
    expect(s.phase).toBe("listening"); // a thinking pause does not cut the seller off
    s = run(frames(LOUD, 400), s); // keeps talking
    s = run(frames(QUIET, VAD.silenceMs - 100), s);
    expect(s.phase).toBe("listening");
    s = run(frames(QUIET, 200), s);
    expect(s.phase).toBe("thinking");
    expect(s.endReason).toBe("silence");
  });

  it("ignores a short blip followed by silence", () => {
    const s = run([...frames(LOUD, 300), ...frames(QUIET, VAD.silenceMs + 400)], listening());
    expect(s.phase).toBe("listening");
    expect(s.vad.speechMs).toBe(0);
  });

  it("caps a take at the max length", () => {
    const s = run(frames(LOUD, VAD.maxTakeMs + 100), listening());
    expect(s.phase).toBe("thinking");
    expect(s.endReason).toBe("max");
  });

  it("drops a silent max-length take and keeps listening", () => {
    const start = listening();
    const s = run(frames(QUIET, VAD.maxTakeMs + 100), start);
    expect(s.phase).toBe("listening");
    expect(s.takeId).toBe(start.takeId + 1);
  });

  it("barge-in: tapping while Tara speaks stops her and listens", () => {
    const speaking = run([{ type: "START" }, { type: "MIC_READY" }, { type: "REPLY_READY", speak: true }]);
    const s = callReducer(speaking, { type: "TAP" });
    expect(s.phase).toBe("listening");
    expect(s.takeId).toBe(speaking.takeId + 1);
    // A late "audio ended" from the interrupted clip is ignored.
    expect(callReducer(s, { type: "SPEAK_END" })).toBe(s);
  });

  it("tap while listening sends early only after real speech", () => {
    const quiet = listening();
    expect(callReducer(quiet, { type: "TAP" })).toBe(quiet);
    const spoke = run(frames(LOUD, 1000), quiet);
    const s = callReducer(spoke, { type: "TAP" });
    expect(s.phase).toBe("thinking");
    expect(s.endReason).toBe("manual");
  });

  it("mute ignores the mic and restarts the take on unmute", () => {
    const start = listening();
    let s = callReducer(start, { type: "MUTE_TOGGLE" });
    expect(s.muted).toBe(true);
    s = run(frames(LOUD, 5000), s);
    expect(s.phase).toBe("listening");
    expect(s.vad.speechMs).toBe(0);
    s = callReducer(s, { type: "MUTE_TOGGLE" });
    expect(s.muted).toBe(false);
    expect(s.takeId).toBe(start.takeId + 2);
  });

  it("pauses while the tab is hidden and resumes with a fresh take", () => {
    const start = run(frames(LOUD, 500), listening());
    let s = callReducer(start, { type: "HIDDEN" });
    expect(s.paused).toBe(true);
    s = run(frames(QUIET, 5000), s);
    expect(s.phase).toBe("listening");
    s = callReducer(s, { type: "VISIBLE" });
    expect(s.paused).toBe(false);
    expect(s.takeId).toBe(start.takeId + 1);
    expect(s.vad.speechMs).toBe(0);
  });

  it("suggests typing after two empty turns in a row", () => {
    let s = callReducer(run(frames(LOUD, 1000), listening()), { type: "TAP" });
    s = callReducer(s, { type: "TURN_RESULT", outcome: "empty" });
    expect(s.suggestTyping).toBe(false);
    s = callReducer(s, { type: "REPLY_READY", speak: false });
    s = callReducer(run(frames(LOUD, 1000), s), { type: "TAP" });
    s = callReducer(s, { type: "TURN_RESULT", outcome: "empty" });
    expect(s.emptyStreak).toBe(2);
    expect(s.suggestTyping).toBe(true);
    s = callReducer(s, { type: "TURN_RESULT", outcome: "heard" });
    expect(s.emptyStreak).toBe(0);
  });

  it("typing during the call drops the take and waits for Tara", () => {
    const s = callReducer(listening(), { type: "TEXT_SENT" });
    expect(s.phase).toBe("thinking");
    expect(s.endReason).toBe("text");
  });

  it("end stops everything from any phase and can start again", () => {
    for (const s of [listening(), run([{ type: "START" }]), run([{ type: "START" }, { type: "MIC_READY" }, { type: "REPLY_READY", speak: true }])]) {
      const ended = callReducer(s, { type: "END" });
      expect(ended.phase).toBe("ended");
      expect(callUiState(ended)).toBe("ready");
      expect(callReducer(ended, { type: "FRAME", level: LOUD, dtMs: 20 })).toBe(ended);
      expect(callReducer(ended, { type: "START" }).phase).toBe("connecting");
    }
  });
});
