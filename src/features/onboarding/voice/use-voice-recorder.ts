"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Preferred MediaRecorder MIME for push-to-talk (webm → mp4 fallback). */
export function recorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}

export function fileExtension(mime: string): string {
  return mime.includes("mp4") ? "mp4" : "webm";
}

const DEFAULT_MIN_MS = 1_500;
const DEFAULT_MAX_MS = 14_000;
const DEFAULT_SILENCE_MS = 1_000;
/** RMS-ish threshold on time-domain samples (0–1); above = speech energy. */
const SPEECH_THRESHOLD = 0.018;

export type VoiceRecorderError = "unsupported" | "denied" | "unknown";

export type UseVoiceRecorderOptions = {
  onRecordingComplete: (blob: Blob) => void;
  onError?: (kind: VoiceRecorderError) => void;
  /** Minimum capture length before silence can auto-stop (default ~1.5s). */
  minMs?: number;
  /** Hard stop (default ~14s). */
  maxMs?: number;
  /** Quiet stretch after speech energy that ends the take (default ~1s). */
  silenceMs?: number;
};

/**
 * Push-to-talk recorder: starts on demand, auto-stops after ~1s of silence once speech
 * was heard, with min/max duration guards. Shared by Tara onboarding and /start voice.
 */
export function useVoiceRecorder(options: UseVoiceRecorderOptions) {
  const { onRecordingComplete, onError, minMs = DEFAULT_MIN_MS, maxMs = DEFAULT_MAX_MS, silenceMs = DEFAULT_SILENCE_MS } = options;
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<{ max?: number; silence?: number }>({});
  const startedAtRef = useRef(0);
  const heardSpeechRef = useRef(false);
  const onCompleteRef = useRef(onRecordingComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const cleanupMonitor = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timersRef.current.max !== undefined) {
      window.clearTimeout(timersRef.current.max);
      timersRef.current.max = undefined;
    }
    if (timersRef.current.silence !== undefined) {
      window.clearTimeout(timersRef.current.silence);
      timersRef.current.silence = undefined;
    }
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }, []);

  const stopRecording = useCallback(() => {
    cleanupMonitor();
    const rec = mediaRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    }
    setRecording(false);
  }, [cleanupMonitor]);

  const startMonitor = useCallback(
    (stream: MediaStream) => {
      heardSpeechRef.current = false;
      startedAtRef.current = Date.now();
      timersRef.current.max = window.setTimeout(() => stopRecording(), maxMs);

      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i]! - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const elapsed = Date.now() - startedAtRef.current;

          if (rms >= SPEECH_THRESHOLD) {
            heardSpeechRef.current = true;
            if (timersRef.current.silence !== undefined) {
              window.clearTimeout(timersRef.current.silence);
              timersRef.current.silence = undefined;
            }
          } else if (heardSpeechRef.current && elapsed >= minMs && timersRef.current.silence === undefined) {
            timersRef.current.silence = window.setTimeout(() => stopRecording(), silenceMs);
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        /* analyser optional — max timer still stops the take */
      }
    },
    [maxMs, minMs, silenceMs, stopRecording],
  );

  const startRecording = useCallback(async () => {
    const mime = recorderMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current?.("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        cleanupMonitor();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        setRecording(false);
        if (blob.size > 0) onCompleteRef.current(blob);
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      startMonitor(stream);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      onErrorRef.current?.(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "unknown");
    }
  }, [cleanupMonitor, startMonitor]);

  const toggle = useCallback(async () => {
    if (recording) {
      stopRecording();
      return;
    }
    await startRecording();
  }, [recording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      cleanupMonitor();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cleanupMonitor]);

  return { recording, startRecording, stopRecording, toggle, mime: recorderMime() };
}
