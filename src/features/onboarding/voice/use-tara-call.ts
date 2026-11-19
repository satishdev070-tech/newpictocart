"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  callActive,
  callReducer,
  initialCallMachine,
  wantsRecognition,
  wantsRecorder,
  type CallEvent,
  type CallMachine,
  type MicFailure,
  type TurnOutcome,
} from "./call-machine";
import {
  END_OF_TURN_MS,
  LONG_PAUSE_MS,
  captionHasText,
  captionReducer,
  captionText,
  classifyRecognitionError,
  emptyCaption,
  loadVoices,
  pickVoice,
  piecesFromResults,
  primeSpeechSynthesis,
  recognitionLang,
  speechRecognitionCtor,
  speechSynthesisApi,
  utteranceTimeoutMs,
  type BrowserRecognition,
  type CaptionEvent,
  type CaptionState,
} from "./browser-speech";
import { recorderMime } from "./use-voice-recorder";

export type TaraSpeech = { audioBase64: string; mimeType: string };

/** One line from Tara: its text (for the browser voice fallback) and server audio when available. */
export type TaraLine = { text: string; speech: TaraSpeech | null };

export type TaraTurnOutcome = {
  outcome: TurnOutcome;
  /** Tara's reply audio (null = text only, or TTS unavailable). */
  speech: TaraSpeech | null;
  /** Tara's reply text: spoken with the browser voice when there is no audio. */
  text?: string;
};

export type UseTaraCallOptions = {
  /** Speak Tara's lines aloud (shell "Voice on" toggle). */
  speak: boolean;
  /** Draft locale (e.g. "hi-IN"): recognition language and fallback voice. */
  locale: string;
  /** Recorder fallback: one finished take → server turn (server STT). */
  onTake: (audio: Blob) => Promise<TaraTurnOutcome>;
  /** Browser recognition: the seller's words → server turn (typed-text path). */
  onHeard: (text: string) => Promise<TaraTurnOutcome>;
  /**
   * Show what was heard in an editable box when the seller stops talking; Tara gets it only after
   * they press Send / Enter (default true). False = hands-free (sent as soon as they stop).
   */
  reviewBeforeSend?: boolean;
  /**
   * When the seller's turn ends. `manual` (default): Tara keeps listening through pauses until the
   * seller taps Done (a 30 s silence is the safety net). `pause`: hands-free, ends after a short pause.
   */
  endTurn?: "manual" | "pause";
  /** Tara's spoken opener (fetched right after the mic opens). */
  greeting: () => Promise<TaraLine>;
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

/**
 * Speak a line with the browser voice for `locale`. Resolves true when it finished, false when it
 * was skipped (no engine, no voice for the language) or cancelled. `register` receives the
 * cancel function before speech starts.
 */
async function speakWithBrowser(text: string, locale: string, isCurrent: () => boolean, register: (cancel: () => void) => void): Promise<boolean> {
  const synth = speechSynthesisApi();
  if (!synth || !text.trim()) return false;
  const voice = pickVoice(await loadVoices(), locale);
  if (!voice || !isCurrent()) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(true);
    };
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.onend = finish;
    u.onerror = finish;
    const timer = window.setTimeout(finish, utteranceTimeoutMs(text));
    register(() => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      synth.cancel();
      resolve(false);
    });
    synth.cancel(); // drop anything queued (e.g. the silent priming utterance)
    synth.speak(u);
  });
}

/** Speak a reply outside a call (typed turns) with the browser voice. Best effort. */
export function sayDetached(text: string, locale: string): void {
  void speakWithBrowser(text, locale, () => true, () => undefined).catch(() => undefined);
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
 * auto-listen → end-of-turn → thinking → Tara speaks → auto-listen … Hearing uses the browser's
 * speech recognition (live caption, sent as text). Browsers without it use MediaRecorder + VAD +
 * server STT. Tara's voice is server TTS, or the browser voice when there is no audio. Tap the orb to
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
  /** Latest "seller finished speaking" handler (browser recognition). */
  const handleHeardRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  // Browser recognition (primary listener).
  const recognitionRef = useRef<{ rec: BrowserRecognition; takeId: number } | null>(null);
  const captionRef = useRef<CaptionState>(emptyCaption);
  const [caption, setCaption] = useState("");
  /** Words waiting for the seller's OK (phase "reviewing"). */
  const [review, setReview] = useState<string | null>(null);
  const endTimerRef = useRef<number | null>(null);
  /** Sessions that ended almost immediately in a row (engine refusing to run). */
  const rapidEndsRef = useRef(0);
  /** Released the meter stream once to free the mic for recognition (audio-capture). */
  const captureRetriedRef = useRef(false);
  /** Latest startRecognition (recognition handlers restart themselves through it). */
  const startRecognitionRef = useRef<(takeId: number) => void>(() => undefined);
  /** Cancels the browser voice when Tara is interrupted. */
  const cancelSynthRef = useRef<(() => void) | null>(null);

  const setMeter = useCallback((level: number) => {
    const v = Math.min(1, level * 9).toFixed(3);
    for (const el of metersRef.current) el.style.setProperty("--lvl", v);
  }, []);

  // ---- side effects ---------------------------------------------------------------

  const applyCaption = useCallback((e: CaptionEvent) => {
    const next = captionReducer(captionRef.current, e);
    if (next === captionRef.current) return;
    captionRef.current = next;
    setCaption(captionText(next));
  }, []);

  const clearEndTimer = useCallback(() => {
    if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
  }, []);

  const stopRecognition = useCallback(() => {
    clearEndTimer();
    const cur = recognitionRef.current;
    recognitionRef.current = null; // handlers check identity, so late events are ignored
    if (!cur) return;
    try {
      cur.rec.abort();
    } catch {
      /* already stopped */
    }
  }, [clearEndTimer]);

  const stopPlayback = useCallback(() => {
    playTokenRef.current += 1;
    const cancelSynth = cancelSynthRef.current;
    cancelSynthRef.current = null;
    cancelSynth?.();
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
    stopRecognition();
    stopPlayback();
    captionRef.current = emptyCaption;
    setCaption("");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    setMeter(0);
  }, [setMeter, stopPlayback, stopRecorder, stopRecognition]);

  /** Seller's turn is over (browser recognition): send what was heard as text. */
  const finishSpokenTurn = useCallback(() => {
    clearEndTimer();
    const text = captionText(captionRef.current);
    const m = machineRef.current;
    if (!text || m.phase !== "listening" || m.listener !== "browser") return;
    stopRecognition();
    if (optsRef.current.reviewBeforeSend !== false) {
      dispatchRef.current({ type: "REVIEW" });
      captionRef.current = emptyCaption;
      setCaption("");
      setReview(text);
      return;
    }
    dispatchRef.current({ type: "SPEECH_DONE" });
    void handleHeardRef.current(text);
  }, [clearEndTimer, stopRecognition]);

  const armEndTimer = useCallback(() => {
    clearEndTimer();
    endTimerRef.current = window.setTimeout(() => {
      endTimerRef.current = null;
      finishSpokenTurn();
    }, optsRef.current.endTurn === "pause" ? END_OF_TURN_MS : LONG_PAUSE_MS);
  }, [clearEndTimer, finishSpokenTurn]);

  /** Re-open the mic (after it was released for recognition) for the recorder fallback. */
  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const ctx = ctxRef.current;
    if (!ctx) return;
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
  }, []);

  /** Browser recognition can't serve this call → MediaRecorder + server STT (or typing). */
  const fallBackToRecorder = useCallback(async () => {
    const epoch = epochRef.current;
    const mime = recorderMime();
    if (mime && !streamRef.current && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (epoch !== epochRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        attachStream(stream);
      } catch {
        /* handled below: no stream → typing */
      }
    }
    if (epoch !== epochRef.current) return;
    dispatchRef.current({ type: "USE_RECORDER", available: Boolean(mime && streamRef.current) });
  }, [attachStream]);

  const startRecognition = useCallback(
    (takeId: number) => {
      const Ctor = speechRecognitionCtor();
      if (!Ctor) {
        void fallBackToRecorder();
        return;
      }
      let rec: BrowserRecognition;
      try {
        rec = new Ctor();
        rec.lang = recognitionLang(optsRef.current.locale);
        rec.continuous = false; // one utterance per session; we restart until the end-of-turn timer fires
        rec.interimResults = true;
        rec.maxAlternatives = 1;
      } catch {
        void fallBackToRecorder();
        return;
      }
      const startedAt = Date.now();
      let error: string | null = null;
      const isCurrent = () => recognitionRef.current?.rec === rec;

      rec.onresult = (e) => {
        if (!isCurrent()) return;
        const pieces = piecesFromResults(e.results);
        applyCaption({ type: "results", pieces });
        if (!captionHasText(captionRef.current)) return;
        rapidEndsRef.current = 0;
        clearEndTimer();
        dispatchRef.current({ type: "SPEECH_HEARD" });
        if (pieces.some((p) => p.isFinal)) armEndTimer();
      };
      rec.onerror = (e) => {
        if (isCurrent()) error = e.error;
      };
      rec.onend = () => {
        if (!isCurrent()) return;
        recognitionRef.current = null;
        applyCaption({ type: "session-end" });
        const m = machineRef.current;
        if (!wantsRecognition(m) || m.takeId !== takeId) return;
        const action = error ? classifyRecognitionError(error) : null;

        if (action === "blocked") {
          optsRef.current.onMicFailed?.("denied");
          dispatchRef.current({ type: "END" });
          return;
        }
        if (action === "fallback") {
          // Android Chrome can't share the mic with our level-meter stream: free it once and retry.
          if (error === "audio-capture" && streamRef.current && !captureRetriedRef.current) {
            captureRetriedRef.current = true;
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            analyserRef.current = null;
            setMeter(0);
            startRecognitionRef.current(takeId);
            return;
          }
          clearEndTimer();
          void fallBackToRecorder();
          return;
        }
        if (captionHasText(captionRef.current)) {
          // A pause: keep listening for more; the end-of-turn timer sends if nothing follows.
          if (endTimerRef.current === null) armEndTimer();
          startRecognitionRef.current(takeId);
          return;
        }
        if (error === "no-speech") {
          rapidEndsRef.current = 0;
          dispatchRef.current({ type: "NO_SPEECH" }); // fresh take → sync restarts quietly
          return;
        }
        // Ended with nothing and no error (some engines do this): restart, unless it keeps refusing.
        rapidEndsRef.current = Date.now() - startedAt < 400 ? rapidEndsRef.current + 1 : 0;
        if (rapidEndsRef.current >= 5) {
          rapidEndsRef.current = 0;
          void fallBackToRecorder();
          return;
        }
        window.setTimeout(() => {
          const now = machineRef.current;
          if (!recognitionRef.current && wantsRecognition(now) && now.takeId === takeId) startRecognitionRef.current(takeId);
        }, rapidEndsRef.current ? 250 : 0);
      };

      recognitionRef.current = { rec, takeId };
      try {
        rec.start();
      } catch {
        recognitionRef.current = null;
        void fallBackToRecorder();
      }
    },
    [applyCaption, armEndTimer, clearEndTimer, fallBackToRecorder, setMeter],
  );
  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  /** Apply the side effects a transition implies. */
  const sync = useCallback(
    (prev: CallMachine, next: CallMachine) => {
      if (next.phase === "ended" && prev.phase !== "ended") {
        teardown();
        return;
      }
      // Leaving a take (turn ended, new take, mute, hidden) → stop it; submit only real turn ends.
      const rec = recorderRef.current;
      const wantRecording = wantsRecorder(next);
      if (rec && (!wantRecording || rec.takeId !== next.takeId)) {
        const submit =
          next.phase === "thinking" && (next.endReason === "silence" || next.endReason === "max" || next.endReason === "manual");
        stopRecorder(submit);
      }
      if (wantRecording && !recorderRef.current) startRecorder(next.takeId);

      // Browser recognition: never runs while Tara speaks (she must not hear herself).
      const recog = recognitionRef.current;
      const wantRecog = wantsRecognition(next);
      if (recog && (!wantRecog || recog.takeId !== next.takeId)) stopRecognition();
      // The live caption belongs to one take; keep it while that turn is being answered.
      const keepCaption = next.takeId === prev.takeId && (next.phase === "listening" || next.endReason === "speech");
      if (!keepCaption && captionRef.current !== emptyCaption) {
        clearEndTimer();
        captionRef.current = emptyCaption;
        setCaption("");
      }
      if (wantRecog && !recognitionRef.current) startRecognition(next.takeId);

      if (prev.phase === "speaking" && next.phase !== "speaking") stopPlayback();

      const ctx = ctxRef.current;
      if (next.paused !== prev.paused) {
        if (ctx) {
          if (next.paused) void ctx.suspend().catch(() => undefined);
          else void ctx.resume().catch(() => undefined);
        }
        const synth = speechSynthesisApi();
        if (synth && cancelSynthRef.current) {
          if (next.paused) synth.pause();
          else synth.resume();
        }
      }
      if (next.phase !== "listening" || next.muted) setMeter(0);
    },
    [clearEndTimer, setMeter, startRecognition, startRecorder, stopPlayback, stopRecognition, stopRecorder, teardown],
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

  /** Speak a line with the browser voice (server sent no audio). */
  const speakBrowser = useCallback(
    async (text: string) => {
      const token = playTokenRef.current;
      const epoch = epochRef.current;
      const isCurrent = () => token === playTokenRef.current && epoch === epochRef.current;
      // Voice lookup first, so a language with no voice goes straight to listening.
      const voice = speechSynthesisApi() && text.trim() ? pickVoice(await loadVoices(), optsRef.current.locale) : null;
      if (!isCurrent() || machineRef.current.phase !== "thinking") return;
      if (!voice) {
        dispatch({ type: "REPLY_READY", speak: false });
        return;
      }
      dispatch({ type: "REPLY_READY", speak: true });
      const spokeToken = playTokenRef.current;
      try {
        await speakWithBrowser(text, optsRef.current.locale, () => spokeToken === playTokenRef.current, (cancel) => {
          cancelSynthRef.current = cancel;
        });
      } catch {
        /* treat as finished */
      }
      if (spokeToken !== playTokenRef.current) return; // interrupted / ended
      cancelSynthRef.current = null;
      dispatch({ type: "SPEAK_END" });
    },
    [dispatch],
  );

  /** Speak a line (welcome or reply) or go straight back to listening. */
  const speakOrListen = useCallback(
    async (line: { speech: TaraSpeech | null; text?: string }) => {
      const { speech } = line;
      const ctx = ctxRef.current;
      if (!optsRef.current.speak) {
        dispatch({ type: "REPLY_READY", speak: false });
        return;
      }
      if (!speech || !ctx) {
        await speakBrowser(line.text ?? "");
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
    [dispatch, speakBrowser],
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
      await speakOrListen(result);
    };
    handleHeardRef.current = async (text: string) => {
      const epoch = epochRef.current;
      let result: TaraTurnOutcome;
      try {
        result = await optsRef.current.onHeard(text);
      } catch {
        result = { outcome: "error", speech: null };
      }
      if (epoch !== epochRef.current) return;
      // The seller's bubble now holds the words: drop the live caption.
      captionRef.current = emptyCaption;
      setCaption("");
      if (machineRef.current.phase !== "thinking") return;
      dispatch({ type: "TURN_RESULT", outcome: result.outcome });
      await speakOrListen(result);
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
    const recognition = speechRecognitionCtor() !== null;
    const mime = recorderMime();
    const gum = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    // Need a way to hear: browser recognition, or recorder + mic for server STT.
    if (!recognition && (!Ctor || !mime || !gum)) {
      dispatch({ type: "MIC_FAILED", reason: "unsupported" });
      optsRef.current.onMicFailed?.("unsupported");
      return;
    }
    captureRetriedRef.current = false;
    rapidEndsRef.current = 0;
    primeSpeechSynthesis(); // inside the gesture → browser voice allowed later (iOS)
    const ctx = Ctor ? new Ctor() : null;
    ctxRef.current = ctx;
    if (ctx) void ctx.resume().catch(() => undefined); // inside the gesture → unlocked for later playback

    // Open the mic once: permission prompt + level meter (and the recorder fallback).
    if (gum) {
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
      attachStream(stream);
    }
    lastFrameRef.current = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      frameStep(t);
    };
    rafRef.current = requestAnimationFrame(loop);
    dispatch({ type: "MIC_READY", listener: recognition ? "browser" : "recorder" });

    let greeting: TaraLine = { text: "", speech: null };
    try {
      greeting = await optsRef.current.greeting();
    } catch {
      /* spoken without server audio (browser voice) or not at all */
    }
    if (epoch !== epochRef.current) return;
    await speakOrListen(greeting);
  }, [attachStream, dispatch, frameStep, speakOrListen]);

  const end = useCallback(() => dispatch({ type: "END" }), [dispatch]);
  /** Orb tap: barge-in while Tara speaks; "send now" while listening. */
  const tap = useCallback(() => {
    const m = machineRef.current;
    if (m.phase === "listening" && m.listener === "browser") {
      finishSpokenTurn(); // sends the live caption, if any
      return;
    }
    dispatch({ type: "TAP" });
  }, [dispatch, finishSpokenTurn]);
  const toggleMute = useCallback(() => dispatch({ type: "MUTE_TOGGLE" }), [dispatch]);

  /** Reviewing: send the (edited) words to Tara. */
  const confirmReview = useCallback(
    (text: string) => {
      const words = text.trim();
      if (machineRef.current.phase !== "reviewing") return;
      setReview(null);
      if (!words) {
        dispatch({ type: "RETAKE" });
        return;
      }
      dispatch({ type: "REVIEW_SEND" });
      void handleHeardRef.current(words);
    },
    [dispatch],
  );
  /** Reviewing: discard and listen again. */
  const retake = useCallback(() => {
    setReview(null);
    dispatch({ type: "RETAKE" });
  }, [dispatch]);

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
      await speakOrListen(result);
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

  return { view, active: callActive(view), caption, review: view.phase === "reviewing" ? review : null, confirmReview, retake, start, end, tap, toggleMute, sendTyped, meterRef };
}

/** Chunks per recorder (kept outside React state; recorders are short-lived). */
const chunks = new WeakMap<MediaRecorder, Blob[]>();
