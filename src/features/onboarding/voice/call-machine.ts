/**
 * Hands-free Tara call as a pure reducer (no DOM, unit-tested). The browser hook
 * (`use-tara-call.ts`) feeds it mic levels and media events and performs the side effects
 * its transitions imply (start/stop a take, play/stop Tara's audio, release the mic).
 *
 * Phases: idle → connecting (mic permission) → thinking (fetching the spoken welcome)
 * → speaking → listening → thinking → speaking → listening … → ended.
 */

export const VAD = {
  /** Quiet stretch after real speech that ends the seller's turn. */
  silenceMs: 1600,
  /** Speech needed before a pause counts as a finished turn (shorter = a cough/blip). */
  minSpeechMs: 800,
  /** Hard cap per take; Sarvam STT accepts ≤30 s, keep a margin for encoder tail. */
  maxTakeMs: 29_000,
  /** Floor for the speech threshold (RMS of time-domain samples, 0–1). */
  minThreshold: 0.012,
  /** Speech = level above noise floor × this ratio. */
  noiseRatio: 2.6,
  /** Noise-floor EMA weight per quiet frame. */
  noiseAlpha: 0.05,
  /** Starting noise-floor estimate. */
  initialNoise: 0.004,
} as const;

export type CallPhase = "idle" | "connecting" | "thinking" | "speaking" | "listening" | "ended";

export type MicFailure = "denied" | "unsupported";

export type TakeEndReason = "silence" | "max" | "manual" | "text";

export type VadState = {
  speechMs: number;
  silenceMs: number;
  takeMs: number;
  noise: number;
};

export type CallMachine = {
  phase: CallPhase;
  muted: boolean;
  /** Tab hidden: capture and playback paused. */
  paused: boolean;
  /** Increments for every fresh listening take; the hook discards a take whose id changed. */
  takeId: number;
  /** Why the last take ended (set on listening → thinking). */
  endReason: TakeEndReason | null;
  /** Consecutive audio turns with no recognisable speech. */
  emptyStreak: number;
  /** Two empty turns in a row → offer typing. */
  suggestTyping: boolean;
  /** Mic could not be opened → typing mode. */
  micFailure: MicFailure | null;
  vad: VadState;
};

export type CallEvent =
  | { type: "START" }
  | { type: "MIC_READY" }
  | { type: "MIC_FAILED"; reason: MicFailure }
  /** Tara's line (welcome or reply) is ready; `speak` = audio will play. */
  | { type: "REPLY_READY"; speak: boolean }
  | { type: "SPEAK_END" }
  | { type: "FRAME"; level: number; dtMs: number }
  /** Tap on the orb: barge-in while Tara speaks, "send now" while listening. */
  | { type: "TAP" }
  | { type: "MUTE_TOGGLE" }
  | { type: "HIDDEN" }
  | { type: "VISIBLE" }
  /** Seller typed a message during the call. */
  | { type: "TEXT_SENT" }
  /** Outcome of the server turn for the last take. */
  | { type: "TURN_RESULT"; outcome: "heard" | "empty" | "error" }
  | { type: "END" };

const freshVad = (noise: number = VAD.initialNoise): VadState => ({ speechMs: 0, silenceMs: 0, takeMs: 0, noise });

export const initialCallMachine: CallMachine = {
  phase: "idle",
  muted: false,
  paused: false,
  takeId: 0,
  endReason: null,
  emptyStreak: 0,
  suggestTyping: false,
  micFailure: null,
  vad: freshVad(),
};

/** A new listening take (keeps the learned noise floor). */
function listen(s: CallMachine): CallMachine {
  return { ...s, phase: "listening", takeId: s.takeId + 1, endReason: null, vad: freshVad(s.vad.noise) };
}

function endTake(s: CallMachine, reason: TakeEndReason): CallMachine {
  return { ...s, phase: "thinking", endReason: reason };
}

/** Current speech threshold for a noise floor. */
export function speechThreshold(noise: number): number {
  return Math.max(VAD.minThreshold, noise * VAD.noiseRatio);
}

/** True while the call is running (mic open or opening). */
export function callActive(s: Pick<CallMachine, "phase">): boolean {
  return s.phase !== "idle" && s.phase !== "ended";
}

/** Seller has said enough in this take for a tap to send it. */
export function takeHasSpeech(s: CallMachine): boolean {
  return s.phase === "listening" && s.vad.speechMs >= VAD.minSpeechMs;
}

function frame(s: CallMachine, level: number, dtMs: number): CallMachine {
  if (s.phase !== "listening" || s.muted || s.paused) return s;
  const dt = Math.max(0, Math.min(dtMs, 250)); // a stalled frame must not end a turn on its own
  let { speechMs, silenceMs, noise } = s.vad;
  const takeMs = s.vad.takeMs + dt;
  if (level >= speechThreshold(noise)) {
    speechMs += dt;
    silenceMs = 0;
  } else {
    noise += VAD.noiseAlpha * (level - noise);
    if (speechMs > 0) silenceMs += dt;
  }

  if (speechMs >= VAD.minSpeechMs && silenceMs >= VAD.silenceMs) {
    return endTake({ ...s, vad: { speechMs, silenceMs, takeMs, noise } }, "silence");
  }
  if (speechMs < VAD.minSpeechMs && silenceMs >= VAD.silenceMs) {
    // A blip (cough, door) followed by quiet: forget it and keep listening in the same take.
    speechMs = 0;
    silenceMs = 0;
  }
  if (takeMs >= VAD.maxTakeMs) {
    if (speechMs >= VAD.minSpeechMs) return endTake({ ...s, vad: { speechMs, silenceMs, takeMs, noise } }, "max");
    return listen({ ...s, vad: { ...s.vad, noise } }); // nothing said: drop the take, keep listening
  }
  return { ...s, vad: { speechMs, silenceMs, takeMs, noise } };
}

export function callReducer(s: CallMachine, e: CallEvent): CallMachine {
  switch (e.type) {
    case "START":
      if (callActive(s)) return s;
      return {
        ...initialCallMachine,
        phase: "connecting",
        takeId: s.takeId,
        vad: freshVad(s.vad.noise),
      };
    case "MIC_READY":
      return s.phase === "connecting" ? { ...s, phase: "thinking", endReason: null } : s;
    case "MIC_FAILED":
      return s.phase === "connecting" ? { ...s, phase: "ended", micFailure: e.reason } : s;
    case "REPLY_READY":
      if (s.phase !== "thinking") return s;
      return e.speak ? { ...s, phase: "speaking" } : listen(s);
    case "SPEAK_END":
      return s.phase === "speaking" ? listen(s) : s;
    case "FRAME":
      return frame(s, e.level, e.dtMs);
    case "TAP":
      if (s.phase === "speaking") return listen(s); // barge-in
      if (takeHasSpeech(s)) return endTake(s, "manual");
      return s;
    case "MUTE_TOGGLE": {
      const muted = !s.muted;
      // Muting drops the current take; unmuting starts a clean one.
      return s.phase === "listening" ? listen({ ...s, muted }) : { ...s, muted };
    }
    case "HIDDEN":
      return s.paused ? s : { ...s, paused: true };
    case "VISIBLE":
      if (!s.paused) return s;
      return s.phase === "listening" ? listen({ ...s, paused: false }) : { ...s, paused: false };
    case "TEXT_SENT":
      if (s.phase === "listening" || s.phase === "speaking") return endTake(s, "text");
      return s;
    case "TURN_RESULT": {
      if (e.outcome === "heard") return { ...s, emptyStreak: 0, suggestTyping: false };
      if (e.outcome === "empty") {
        const emptyStreak = s.emptyStreak + 1;
        return { ...s, emptyStreak, suggestTyping: s.suggestTyping || emptyStreak >= 2 };
      }
      return s;
    }
    case "END":
      return s.phase === "ended" ? s : { ...s, phase: "ended", paused: false, endReason: null };
  }
}

/** What the four-state UI shows. */
export type CallUiState = "ready" | "listening" | "thinking" | "speaking";

export function callUiState(s: Pick<CallMachine, "phase">): CallUiState {
  if (s.phase === "listening") return "listening";
  if (s.phase === "speaking") return "speaking";
  if (s.phase === "thinking" || s.phase === "connecting") return "thinking";
  return "ready";
}
