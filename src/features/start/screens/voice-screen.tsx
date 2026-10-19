"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { startVoiceTurnAction } from "../actions";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { TaraOrb } from "../components/tara-orb";
import { factsComplete, type VoiceFacts } from "@/features/onboarding/voice/facts";

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
  onFacts: (facts: VoiceFacts, done: boolean) => void;
  onDone: () => void;
  onManual: () => void;
  onQuiz: () => void;
}) {
  const c = startCopy(draft.locale);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submitTurn = useCallback(
    async (audio?: Blob | null) => {
      const fd = new FormData();
      fd.set("locale", draft.locale);
      fd.set("factsJson", JSON.stringify(draft.voice.facts));
      if (text.trim()) fd.set("text", text.trim());
      if (audio) fd.set("audio", audio, "turn.webm");
      setError(null);
      const result = await startVoiceTurnAction(null, fd);
      if (result?.ok && result.data) {
        onFacts(result.data.facts, result.data.done);
        setText("");
        if (result.data.done) onDone();
        if (result.data.audioBase64 && result.data.audioMimeType) {
          try {
            const bin = atob(result.data.audioBase64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: result.data.audioMimeType });
            const url = URL.createObjectURL(blob);
            const audioEl = new Audio(url);
            audioEl.play().finally(() => URL.revokeObjectURL(url));
          } catch {
            /* ignore playback errors */
          }
        }
      } else if (result && !result.ok) {
        setError(result.error?.message ?? "Something went wrong. Try again or use manual setup.");
      }
    },
    [draft.locale, draft.voice.facts, onDone, onFacts, text],
  );

  async function toggleRecord() {
    if (!voiceEnabled || !voiceReady) return;
    if (recording && mediaRef.current) {
      mediaRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void submitTurn(blob);
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      /* mic denied */
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
        <div className="rounded-2xl border border-white/90 bg-white/70 p-4 text-sm">
          {facts.name || facts.category || facts.city || facts.tagline ? (
            <ul className="space-y-1">
              {facts.name ? <li><strong>Name:</strong> {facts.name}</li> : null}
              {facts.category ? <li><strong>Category:</strong> {facts.category}</li> : null}
              {facts.city ? <li><strong>City:</strong> {facts.city}</li> : null}
              {facts.tagline ? <li><strong>Tagline:</strong> {facts.tagline}</li> : null}
            </ul>
          ) : (
            <p className="text-[#6B6275]">{c.voice.understoodHint}</p>
          )}
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
        <p className="text-sm text-[#6B6275]">{c.voice.tapMic}</p>
        <div className="max-w-md rounded-2xl bg-white/80 px-5 py-3 text-sm shadow-sm">{c.voice.prompt}</div>
        {voiceEnabled ? (
          <button
            type="button"
            onClick={() => void toggleRecord()}
            className={cn(
              "grid size-20 place-items-center rounded-full bg-[#F97316] text-white shadow-lg",
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
            className="flex-1 rounded-full border border-[#2A2233]/10 bg-white px-4 py-2 text-sm"
          />
          <button type="button" onClick={() => void submitTurn()} className="rounded-full bg-[#2A2233] px-4 py-2 text-sm text-white">
            {c.voice.send}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
