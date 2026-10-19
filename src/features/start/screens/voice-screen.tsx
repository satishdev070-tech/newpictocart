"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { startVoiceTurnAction } from "../actions";
import { startCopy } from "../copy";
import type { StartDraft, StartVoiceTurn } from "../draft/schema";
import { TaraOrb } from "../components/tara-orb";
import { factsComplete, type VoiceFacts } from "@/features/onboarding/voice/facts";

function recorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}

function fileExtension(mime: string): string {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export function VoiceScreen({
  draft,
  voiceReady,
  voiceEnabled,
  onFacts,
  onDone,
  onManual,
  onQuiz,
}: {
  draft: StartDraft;
  voiceReady: boolean;
  voiceEnabled: boolean;
  onFacts: (facts: VoiceFacts, done: boolean, turns: StartVoiceTurn[]) => void;
  onDone: () => void;
  onManual: () => void;
  onQuiz: () => void;
}) {
  const c = startCopy(draft.locale);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const turns = draft.voice.turns;

  const playSpeech = useCallback((audioBase64: string, mimeType: string) => {
    try {
      const bin = atob(audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const audioEl = new Audio(url);
      audioEl.play().finally(() => URL.revokeObjectURL(url));
    } catch {
      /* playback is optional; the written reply stays on screen */
    }
  }, []);

  const submitTurn = useCallback(
    async (audio?: Blob | null) => {
      const typed = text.trim();
      if (!typed && (!audio || audio.size === 0)) {
        setError(c.voice.typePlaceholder);
        return;
      }
      const fd = new FormData();
      fd.set("locale", draft.locale);
      fd.set("factsJson", JSON.stringify(draft.voice.facts));
      fd.set("historyJson", JSON.stringify(turns));
      if (typed) fd.set("text", typed);
      if (audio && audio.size > 0) {
        const mime = audio.type || "audio/webm";
        fd.set("audio", audio, `turn.${fileExtension(mime)}`);
      }
      setError(null);
      setBusy(true);
      try {
        const result = await startVoiceTurnAction(null, fd);
        if (result?.ok && result.data) {
          const next: StartVoiceTurn[] = [
            ...turns.slice(-10).map((turn) => ({
              role: turn.role === "tara" ? ("tara" as const) : ("seller" as const),
              text: turn.text.slice(0, 800),
            })),
            { role: "seller", text: result.data.transcript.slice(0, 800) },
            { role: "tara", text: result.data.reply.slice(0, 800) },
          ];
          onFacts(result.data.facts, result.data.done, next);
          setText("");
          if (result.data.audioBase64 && result.data.audioMimeType) {
            playSpeech(result.data.audioBase64, result.data.audioMimeType);
          }
        } else if (result && !result.ok) {
          setError(result.error.fieldErrors?._form?.[0] ?? result.error.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [c.voice.typePlaceholder, draft.locale, draft.voice.facts, onFacts, playSpeech, text, turns],
  );

  async function toggleRecord() {
    if (!voiceEnabled || !voiceReady || busy) return;
    if (recording && mediaRef.current) {
      mediaRef.current.stop();
      setRecording(false);
      return;
    }
    const mime = recorderMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError(c.voice.micUnsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        void submitTurn(blob);
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setError(null);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(name === "NotAllowedError" || name === "PermissionDeniedError" ? c.voice.micDenied : c.voice.micUnsupported);
    }
  }

  if (!voiceReady) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
        <p className="text-[#5E5568]">{c.voice.noVoice}</p>
        <button type="button" onClick={onManual} className="rounded-full bg-[#F97316] px-6 py-3 font-semibold text-white">
          {c.voice.continueManual}
        </button>
      </section>
    );
  }

  const facts = draft.voice.facts;

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-[#6B6275]">{c.voice.understood}</p>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-white/90 bg-white/70 p-4 text-sm">
          {turns.length ? (
            turns.map((turn, i) => (
              <p key={`${turn.role}-${i}`} className={turn.role === "tara" ? "text-[#7C5AA6]" : "text-[#2A2233]"}>
                <span className="font-semibold">{turn.role === "tara" ? "Tara" : "You"}: </span>
                {turn.text}
              </p>
            ))
          ) : (
            <p className="text-[#6B6275]">{c.voice.understoodHint}</p>
          )}
          {facts.name || facts.category || facts.city || facts.tagline ? (
            <ul className="mt-3 space-y-1 border-t border-[#2A2233]/10 pt-3">
              {facts.name ? <li><strong>Name:</strong> {facts.name}</li> : null}
              {facts.category ? <li><strong>Category:</strong> {facts.category}</li> : null}
              {facts.city ? <li><strong>City:</strong> {facts.city}</li> : null}
              {facts.tagline ? <li><strong>Tagline:</strong> {facts.tagline}</li> : null}
            </ul>
          ) : null}
        </div>
        <button type="button" onClick={onManual} className="text-sm text-[#7C5AA6] underline">
          {c.switchManual}
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 text-center">
        <TaraOrb size="lg" className="mx-auto" />
        <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className={cn("w-1 rounded-full bg-linear-to-t from-[#F97316] to-[#C084FC]", recording ? "animate-pulse" : "opacity-40")}
              style={{ height: `${12 + (i % 4) * 6}px` }}
            />
          ))}
        </div>
        <p className="text-sm text-[#6B6275]">{busy ? c.voice.thinking : c.voice.tapMic}</p>
        <div className="max-w-md rounded-2xl bg-white/80 px-5 py-3 text-sm shadow-sm">{c.voice.prompt}</div>
        {voiceEnabled ? (
          <button
            type="button"
            onClick={() => void toggleRecord()}
            disabled={busy}
            className={cn(
              "grid size-20 place-items-center rounded-full bg-[#F97316] text-white shadow-lg disabled:opacity-50",
              recording && "ring-4 ring-[#FED7AA]",
            )}
            aria-label={c.voice.tapTalk}
          >
            <span className="text-2xl">🎤</span>
          </button>
        ) : null}
        <p className="text-xs text-[#6B6275]">{c.voice.tapTalk}</p>
        <div className="flex w-full max-w-md gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={c.voice.typePlaceholder}
            disabled={busy}
            className="flex-1 rounded-full border border-[#2A2233]/10 bg-white px-4 py-2 text-sm"
          />
          <button type="button" onClick={() => void submitTurn()} disabled={busy} className="rounded-full bg-[#2A2233] px-4 py-2 text-sm text-white disabled:opacity-50">
            {c.voice.send}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        <button type="button" onClick={onQuiz} className="rounded-full border border-[#2A2233]/10 bg-white/60 px-4 py-2 text-sm">
          {c.voice.preferQuiz}
        </button>
        {factsComplete(draft.voice.facts as VoiceFacts) ? (
          <button type="button" onClick={onDone} className="rounded-full bg-[#F97316] px-6 py-3 font-semibold text-white">
            Continue →
          </button>
        ) : null}
      </div>
    </section>
  );
}
