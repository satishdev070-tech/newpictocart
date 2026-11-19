"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dictate, speechInputSupported, type ListenHandle } from "@/lib/speech/browser-speech";
import { useVoiceInput } from "./use-voice-input";

/**
 * Copilot mic. The browser's own speech recognition is primary (free, no upload, works when Sarvam
 * is out of credits) and keeps listening through pauses until the seller taps Stop (`dictate`);
 * `onInterim` streams the words live. Browsers without it (Firefox) fall back to recording and
 * the Sarvam transcribe action. `onText` gets the final transcript either way.
 */
export function useCopilotMic(opts: {
  lang: string;
  onText: (text: string) => void;
  onInterim?: (text: string) => void;
  onAudio: (audio: Blob) => void;
  onError: (reason: "unsupported" | "denied" | "network" | "no-speech") => void;
}) {
  const { lang, onText, onInterim, onAudio, onError } = opts;
  const recorder = useVoiceInput(onAudio, onError);
  const [browserSupported, setBrowserSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const handle = useRef<ListenHandle | null>(null);

  // Feature-detect after mount (SSR renders the recorder state first).
  useEffect(() => {
    const id = setTimeout(() => setBrowserSupported(speechInputSupported()), 0);
    return () => clearTimeout(id);
  }, []);

  const stopBrowser = useCallback(() => handle.current?.stop(), []);

  const startBrowser = useCallback(() => {
    setListening(true);
    handle.current = dictate(lang, {
      onInterim: (t) => onInterim?.(t),
      onFinal: (t) => {
        handle.current = null;
        setListening(false);
        if (t) onText(t);
        else onError("no-speech");
      },
      onError: (reason) => {
        handle.current = null;
        setListening(false);
        if (reason === "aborted") return;
        onError(reason === "not-allowed" ? "denied" : reason === "network" ? "network" : reason === "unsupported" ? "unsupported" : "no-speech");
      },
    });
    if (!handle.current) setListening(false);
  }, [lang, onError, onInterim, onText]);

  useEffect(() => () => handle.current?.abort(), []);

  if (browserSupported) {
    return { recording: listening, supported: true, start: async () => startBrowser(), stop: stopBrowser, mode: "browser" as const };
  }
  return { recording: recorder.recording, supported: recorder.supported, start: recorder.start, stop: recorder.stop, mode: "recorder" as const };
}
