"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  callActive,
  callReducer,
  initialCallMachine,
  type CallEvent,
  type CallMachine,
  type MicFailure,
} from "./call-machine";
import { recorderMime } from "./use-voice-recorder";

export type TaraSpeech = { audioBase64: string; mimeType: string };

export type TaraTurnOutcome = {
  outcome: "heard" | "empty" | "error";
  /** Tara's reply audio (null = text only). */
  speech: TaraSpeech | null;
};

export type UseTaraCallOptions = {
  /** Speak Tara's lines aloud (shell "Voice on" toggle). */
  speak: boolean;
  /** One finished take → server turn. Resolve once the transcript/facts are updated. */
  onTake: (audio: Blob) => Promise<TaraTurnOutcome>;
  /** Tara's spoken opener (fetched right after the mic opens). */
  greeting: () => Promise<TaraSpeech | null>;
  onMicFailed?: (reason: MicFailure) => void;
};

/** Fields the UI renders (everything except the per-frame VAD counters). */
export type TaraCallView = Omit<CallMachine, "vad">;

function viewOf(m: CallMachine): TaraCallView {
  const { vad: _vad, ...view } = m;
  return view;
}

function sameView(a: TaraCallView, b: TaraCallView): boolean {
  return (Object.keys(a) as (keyof TaraCallView)[]).every((k) => a[k] === b[k]);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type AudioCtxCtor = typeof AudioContext;
function audioContextCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext ?? null;
}

/** Play one clip outside a call (typed turns). Best effort: autoplay may block it. */
export function playDetached(speech: TaraSpeech): () => void {
  try {
    const url = URL.createObjectURL(new Blob([base64ToBytes(speech.audioBase64)], { type: speech.mimeType }));
    const el = new Audio(url);
    const done = () => URL.revokeObjectURL(url);
    el.onended = done;
    el.onerror = done;
    el.play().catch(done);
    return () => {
      el.pause();
      done();
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Hands-free Tara call (Claude-voice-mode style): Start → mic permission → spoken welcome →
 * auto-listen → VAD end-of-turn → thinking → Tara speaks → auto-listen … Tap the orb to
 * interrupt Tara or send early; mute; end releases the mic and closes the AudioContext.
 * Playback goes through the AudioContext created in the Start tap, so autoplay rules are met.
 */
export function useTaraCall(options: UseTaraCallOptions) {
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const machineRef = useRef<CallMachine>(initialCallMachine);
  const [view, setView] = useState<TaraCallView>(() => viewOf(initialCallMachine));

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const recorderRef = useRef<{ rec: MediaRecorder; takeId: number } | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  /** Bumps on start/end so late async results from an old call are ignored. */
  const epochRef = useRef(0);
  /** Bumps whenever playback stops so a late decode can't start stale audio. */
  const playTokenRef = useRef(0);
  const metersRef = useRef(new Set<HTMLElement>());
  /** Latest "take finished" handler (set in an effect; called from MediaRecorder.onstop). */
  const handleTakeRef = useRef<(blob: Blob) => Promise<void>>(async () => undefined);

  const setMeter = useCallback((level: number) => {
    const v = Math.min(1, level * 9).toFixed(3);
    for (const el of metersRef.current) el.style.setProperty("--lvl", v);
  }, []);

  // ---- side effects ---------------------------------------------------------------

  const stopPlayback = useCallback(() => {
    playTokenRef.current += 1;
    const src = sourceRef.current;
    sourceRef.current = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const dispatchRef = useRef<(e: CallEvent) => void>(() => undefined);

  const stopRecorder = useCallback((submit: boolean) => {
    const cur = recorderRef.current;
    recorderRef.current = null;
    if (!cur) return;
    const { rec } = cur;
    if (!submit) rec.ondataavailable = null;
    rec.onstop = submit
      ? () => {
          const blob = new Blob(chunks.get(rec) ?? [], { type: rec.mimeType || recorderMime() || "audio/webm" });
          chunks.delete(rec);
          void handleTakeRef.current(blob);
        }
      : () => chunks.delete(rec);
    if (rec.state !== "inactive") rec.stop();
    else rec.onstop?.(new Event("stop"));
  }, []);

  const startRecorder = useCallback((takeId: number) => {
    const stream = streamRef.current;
    const mime = recorderMime();
    if (!stream || !mime) return;
    try {
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunks.set(rec, []);
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.get(rec)?.push(e.data);
      };
      rec.start();
      recorderRef.current = { rec, takeId };
    } catch {
      recorderRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    epochRef.current += 1;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopRecorder(false);
    stopPlayback();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    setMeter(0);
  }, [setMeter, stopPlayback, stopRecorder]);

  /** Apply the side effects a transition implies. */
  const sync = useCallback(
    (prev: CallMachine, next: CallMachine) => {
      if (next.phase === "ended" && prev.phase !== "ended") {
        teardown();
        return;
      }
      // Leaving a take (turn ended, new take, mute, hidden) → stop it; submit only real turn ends.
      const rec = recorderRef.current;
      const wantRecording = next.phase === "listening" && !next.muted && !next.paused;
      if (rec && (!wantRecording || rec.takeId !== next.takeId)) {
        const submit =
          next.phase === "thinking" && (next.endReason === "silence" || next.endReason === "max" || next.endReason === "manual");
        stopRecorder(submit);
      }
      if (wantRecording && !recorderRef.current) startRecorder(next.takeId);

      if (prev.phase === "speaking" && next.phase !== "speaking") stopPlayback();

      const ctx = ctxRef.current;
      if (ctx && next.paused !== prev.paused) {
        if (next.paused) void ctx.suspend().catch(() => undefined);
        else void ctx.resume().catch(() => undefined);
      }
      if (next.phase !== "listening" || next.muted) setMeter(0);
    },
    [setMeter, startRecorder, stopPlayback, stopRecorder, teardown],
  );

  const dispatch = useCallback(
    (e: CallEvent) => {
      const prev = machineRef.current;
      const next = callReducer(prev, e);
      if (next === prev) return;
      machineRef.current = next;
      sync(prev, next);
      const nextView = viewOf(next);
      setView((cur) => (sameView(cur, nextView) ? cur : nextView));
    },
    [sync],
  );
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  /** Speak a line (welcome or reply) or go straight back to listening. */
  const speakOrListen = useCallback(
    async (speech: TaraSpeech | null) => {
      const ctx = ctxRef.current;
      if (!speech || !optsRef.current.speak || !ctx) {
        dispatch({ type: "REPLY_READY", speak: false });
        return;
      }
      dispatch({ type: "REPLY_READY", speak: true });
      const token = playTokenRef.current;
      try {
        const bytes = base64ToBytes(speech.audioBase64);
        const buffer = await ctx.decodeAudioData(bytes.buffer);
        if (token !== playTokenRef.current || machineRef.current.phase !== "speaking" || ctxRef.current !== ctx) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.onended = () => {
          if (sourceRef.current === src) sourceRef.current = null;
          dispatch({ type: "SPEAK_END" });
        };
        sourceRef.current = src;
        src.start();
      } catch {
        if (token === playTokenRef.current) dispatch({ type: "SPEAK_END" });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    handleTakeRef.current = async (blob: Blob) => {
      const epoch = epochRef.current;
      let result: TaraTurnOutcome;
      try {
        result = blob.size > 0 ? await optsRef.current.onTake(blob) : { outcome: "empty", speech: null };
      } catch {
        result = { outcome: "error", speech: null };
      }
      if (epoch !== epochRef.current || machineRef.current.phase !== "thinking") return;
      dispatch({ type: "TURN_RESULT", outcome: result.outcome });
      await speakOrListen(result.speech);
    };
  }, [dispatch, speakOrListen]);

  // ---- mic level loop ---------------------------------------------------------------

  /** One animation frame: read the mic level, drive the meter and the VAD. */
  const frameStep = useCallback(
    (now: number) => {
      const analyser = analyserRef.current;
      const samples = samplesRef.current;
      const dt = lastFrameRef.current ? now - lastFrameRef.current : 16;
      lastFrameRef.current = now;
      const m = machineRef.current;
      if (!analyser || !samples || m.phase !== "listening" || m.muted || m.paused) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
      const level = Math.sqrt(sum / samples.length);
      setMeter(level);
      dispatch({ type: "FRAME", level, dtMs: dt });
    },
    [dispatch, setMeter],
  );

  // ---- public API -------------------------------------------------------------------

  /** Must run inside the Start tap (user gesture): creates/unlocks audio and asks for the mic. */
  const start = useCallback(async () => {
    if (callActive(machineRef.current)) return;
    dispatch({ type: "START" });
    const epoch = ++epochRef.current;

    const Ctor = audioContextCtor();
    const mime = recorderMime();
    if (!Ctor || !mime || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "MIC_FAILED", reason: "unsupported" });
      optsRef.current.onMicFailed?.("unsupported");
      return;
    }
    const ctx = new Ctor();
    ctxRef.current = ctx;
    void ctx.resume().catch(() => undefined); // inside the gesture → unlocked for later playback

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      if (epoch !== epochRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      const reason: MicFailure = name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" ? "denied" : "unsupported";
      dispatch({ type: "MIC_FAILED", reason });
      optsRef.current.onMicFailed?.(reason);
      return;
    }
    if (epoch !== epochRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      samplesRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    } catch {
      analyserRef.current = null; // no VAD: the take cap and the orb tap still end turns
    }
    lastFrameRef.current = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      frameStep(t);
    };
    rafRef.current = requestAnimationFrame(loop);
    dispatch({ type: "MIC_READY" });

    let greeting: TaraSpeech | null = null;
    try {
      greeting = await optsRef.current.greeting();
    } catch {
      greeting = null;
    }
    if (epoch !== epochRef.current) return;
    await speakOrListen(greeting);
  }, [dispatch, frameStep, speakOrListen]);

  const end = useCallback(() => dispatch({ type: "END" }), [dispatch]);
  const tap = useCallback(() => dispatch({ type: "TAP" }), [dispatch]);
  const toggleMute = useCallback(() => dispatch({ type: "MUTE_TOGGLE" }), [dispatch]);

  /** Typed message during the call: drops the current take, runs the turn, then speaks/listens. */
  const sendTyped = useCallback(
    async (run: () => Promise<TaraTurnOutcome>) => {
      dispatch({ type: "TEXT_SENT" });
      const epoch = epochRef.current;
      let result: TaraTurnOutcome;
      try {
        result = await run();
      } catch {
        result = { outcome: "error", speech: null };
      }
      if (epoch !== epochRef.current || machineRef.current.phase !== "thinking") return;
      dispatch({ type: "TURN_RESULT", outcome: result.outcome });
      await speakOrListen(result.speech);
    },
    [dispatch, speakOrListen],
  );

  /** Callback ref for elements that show the live input level as the CSS var `--lvl` (0–1). */
  const meterRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const meters = metersRef.current;
    meters.add(el);
    return () => {
      meters.delete(el);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (!callActive(machineRef.current)) return;
      dispatch({ type: document.visibilityState === "hidden" ? "HIDDEN" : "VISIBLE" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [dispatch]);

  useEffect(() => teardown, [teardown]);

  return { view, active: callActive(view), start, end, tap, toggleMute, sendTyped, meterRef };
}

/** Chunks per recorder (kept outside React state; recorders are short-lived). */
const chunks = new WeakMap<MediaRecorder, Blob[]>();
