"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_MS = 30_000;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

/**
 * Push-to-talk recorder (MediaRecorder, ≤30 s). `onDone` gets the recorded Blob; the caller
 * sends it to its panel's transcribe server action.
 */
export function useVoiceInput(onDone: (audio: Blob) => void, onError: (reason: "unsupported" | "denied") => void) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported) return onError("unsupported");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("denied");
    }
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      recRef.current = null;
      const type = (rec.mimeType || mimeType || "audio/webm").split(";")[0]!;
      if (chunks.length) onDone(new Blob(chunks, { type }));
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    timerRef.current = setTimeout(stop, MAX_MS);
  }, [supported, onDone, onError, stop]);

  useEffect(() => () => stop(), [stop]);

  return { recording, supported, start, stop };
}
