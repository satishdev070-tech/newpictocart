"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, PhoneOff } from "lucide-react";
import { OnbCard, OnbSub, onbButton } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { isIndustry } from "@/features/stores/industries";
import { startVoiceTurnAction } from "../actions";
import type { StartDraft, StartVoiceTurn } from "../draft/schema";
import {
  confirmationReady,
  normalizeFacts,
  toConfirmedFacts,
  type ConfirmedStoreFacts,
  type VoiceFacts,
} from "@/features/onboarding/voice/facts";
import {
  entriesFromTurns,
  entriesToHistory,
  formatCallClock,
  makeEntry,
  turnToEntries,
  type TranscriptEntry,
} from "@/features/onboarding/voice/transcript";
import { fileExtension, useVoiceRecorder } from "@/features/onboarding/voice/use-voice-recorder";
import { CallPanel, MicButton, callStateLabel, type CallState } from "../components/voice/call-panel";
import { ConfirmCard } from "../components/voice/confirm-card";
import { TranscriptPanel } from "../components/voice/transcript-panel";
import { voiceUiCopy } from "../components/voice/voice-copy";

export type VoiceScreenProps = {
  draft: StartDraft;
  /** Sarvam configured on this platform. False → quiz / manual fallback only. */
  voiceReady: boolean;
  /** Shell "Voice on" toggle: speak Tara's replies aloud (TTS) when true. */
  voiceEnabled: boolean;
  onBack: () => void;
  /** Every turn: latest facts, done flag and the recent conversation (persist to the draft). */
  onFacts: (facts: VoiceFacts, done: boolean, turns: StartVoiceTurn[]) => void;
  /** Legacy completion; used on confirm only when `onConfirm` isn't passed. */
  onDone: () => void;
  onManual: () => void;
  onQuiz: () => void;
  /** Seller tapped "Looks good — continue" on Tara's summary card. */
  onConfirm?: (facts: ConfirmedStoreFacts) => void;
};

function initialFacts(draft: StartDraft): VoiceFacts {
  const f = draft.voice.facts as StartDraft["voice"]["facts"] & { categories?: string[]; subcategories?: string[] };
  return normalizeFacts({
    name: f.name,
    category: f.category && isIndustry(f.category) ? f.category : null,
    subcategory: f.subcategory,
    productsServices: f.productsServices,
    siteMode: f.siteMode,
    tagline: f.tagline,
    city: f.city,
    categories: f.categories ?? [],
    subcategories: f.subcategories ?? [],
  });
}

export function VoiceScreen({
  draft,
  voiceReady,
  voiceEnabled,
  onBack,
  onFacts,
  onDone,
  onManual,
  onQuiz,
  onConfirm,
}: VoiceScreenProps) {
  const t = voiceUiCopy(draft.locale);
  const [facts, setFacts] = useState<VoiceFacts>(() => initialFacts(draft));
  const [entries, setEntries] = useState<TranscriptEntry[]>(() => {
    const saved = entriesFromTurns(draft.voice.turns ?? []);
    return saved.length ? saved : [makeEntry("tara", voiceUiCopy(draft.locale).greeting, null)];
  });
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [endedElapsed, setEndedElapsed] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [typingOpen, setTypingOpen] = useState(false);
  /** Transcript length when the seller tapped "Keep talking" (card hides until the next turn). */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const discardRecordingRef = useRef(false);

  const callOn = callStartedAt !== null;

  useEffect(() => {
    if (callStartedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [callStartedAt]);

  const stopSpeech = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.src = "";
    }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => stopSpeech, [stopSpeech]);

  const playSpeech = useCallback(
    (audioBase64: string, mimeType: string) => {
      stopSpeech();
      try {
        const bin = atob(audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        const el = new Audio(url);
        audioRef.current = el;
        audioUrlRef.current = url;
        el.onended = stopSpeech;
        el.onerror = stopSpeech;
        setSpeaking(true);
        el.play().catch(stopSpeech);
      } catch {
        stopSpeech(); // playback is optional; the written reply stays on screen
      }
    },
    [stopSpeech],
  );

  const runTurn = useCallback(
    async (payload: { text?: string; audio?: Blob }) => {
      const fd = new FormData();
      fd.set("locale", draft.locale);
      fd.set("factsJson", JSON.stringify(facts));
      fd.set("historyJson", JSON.stringify(entriesToHistory(entries)));
      if (payload.text) fd.set("text", payload.text);
      if (payload.audio && payload.audio.size > 0) {
        const mime = payload.audio.type || "audio/webm";
        fd.set("audio", payload.audio, `turn.${fileExtension(mime)}`);
      }
      setBusy(true);
      try {
        const result = await startVoiceTurnAction(null, fd);
        if (!result) return;
        if (!result.ok) {
          const msg = result.error.fieldErrors?._form?.[0] ?? result.error.message;
          setEntries((prev) => [...prev, makeEntry("system", msg)]);
          return;
        }
        const data = result.data;
        const added = turnToEntries(data, Date.now(), t.didntCatch);
        const nextEntries = [...entries, ...added];
        setEntries(nextEntries);
        if (data.heard === false) return;
        const nextFacts = normalizeFacts(data.facts);
        setFacts(nextFacts);
        onFacts(nextFacts, data.done, entriesToHistory(nextEntries));
        if (voiceEnabled && data.audioBase64 && data.audioMimeType) playSpeech(data.audioBase64, data.audioMimeType);
      } catch {
        setEntries((prev) => [...prev, makeEntry("system", t.didntCatch)]);
      } finally {
        setBusy(false);
      }
    },
    [draft.locale, entries, facts, onFacts, playSpeech, t.didntCatch, voiceEnabled],
  );

  const openTyping = useCallback(() => {
    setTypingOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const { recording, startRecording, stopRecording } = useVoiceRecorder({
    onRecordingComplete: (blob) => {
      if (discardRecordingRef.current) {
        discardRecordingRef.current = false;
        return;
      }
      void runTurn({ audio: blob });
    },
    onError: (kind) => {
      if (kind === "unknown") {
        setMicNotice(t.micUnsupported);
      } else {
        setMicBlocked(true);
        setMicNotice(kind === "denied" ? t.micBlocked : t.micUnsupported);
      }
      openTyping();
    },
  });

  const state: CallState = recording ? "listening" : busy ? "thinking" : speaking ? "speaking" : "ready";
  const elapsedMs = callStartedAt !== null ? Math.max(0, (now || callStartedAt) - callStartedAt) : endedElapsed;

  function pressMic() {
    if (micBlocked || busy) return;
    if (recording) {
      stopRecording();
      return;
    }
    if (speaking) stopSpeech();
    if (callStartedAt === null) {
      const start = Date.now();
      setCallStartedAt(start);
      setNow(start);
      setEndedElapsed(null);
    }
    discardRecordingRef.current = false;
    void startRecording();
  }

  function endCall() {
    if (recording) {
      discardRecordingRef.current = true;
      stopRecording();
    }
    stopSpeech();
    if (callStartedAt !== null) setEndedElapsed(Math.max(0, Date.now() - callStartedAt));
    setCallStartedAt(null);
  }

  function sendText(text: string) {
    if (callStartedAt === null) {
      const start = Date.now();
      setCallStartedAt(start);
      setNow(start);
      setEndedElapsed(null);
    }
    void runTurn({ text });
  }

  function clearTranscript() {
    const fresh = [makeEntry("tara", t.greeting)];
    setEntries(fresh);
    setDismissedAt(null);
    onFacts(facts, confirmationReady(facts), []);
  }

  function editFacts(patch: Partial<VoiceFacts>) {
    setFacts((f) =>
      normalizeFacts({
        ...f,
        ...patch,
        // Lists are the source of truth for chips; clear the mirrors so normalize re-derives them.
        ...(patch.categories ? { category: null } : {}),
        ...(patch.subcategories ? { subcategory: null } : {}),
      }),
    );
  }

  function confirm() {
    const confirmed = toConfirmedFacts(facts);
    if (confirmed.name.length < 2 || !confirmed.categories.length || !confirmed.subcategories.length) return;
    endCall();
    const final = normalizeFacts({ ...facts, name: confirmed.name, city: confirmed.city });
    onFacts(final, true, entriesToHistory(entries));
    if (onConfirm) onConfirm(confirmed);
    else onDone();
  }

  if (!voiceReady) {
    return (
      <OnbCard className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
        <OnbSub>{t.noVoice}</OnbSub>
        <button type="button" onClick={onQuiz} className={onbButton.primary}>
          {t.useQuiz}
        </button>
        <button type="button" onClick={onManual} className={onbButton.secondary}>
          {t.manual}
        </button>
        <button type="button" onClick={onBack} className={onbButton.ghost}>
          <ArrowLeft className="size-4" aria-hidden />
          {t.back}
        </button>
      </OnbCard>
    );
  }

  const showConfirm = confirmationReady(facts) && (dismissedAt === null || entries.length > dismissedAt);

  return (
    <section className="mx-auto w-full max-w-6xl pb-24 lg:pb-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <CallPanel
          t={t}
          state={state}
          callOn={callOn}
          elapsedMs={elapsedMs}
          micBlocked={micBlocked}
          micNotice={micNotice}
          busy={busy}
          inputRef={inputRef}
          typingOpen={typingOpen}
          onTypingOpen={openTyping}
          onMic={pressMic}
          onEndCall={endCall}
          onSendText={sendText}
        />
        <TranscriptPanel
          t={t}
          entries={entries}
          thinking={busy}
          onClear={clearTranscript}
          footer={
            showConfirm ? (
              <ConfirmCard
                t={t}
                facts={facts}
                onChange={editFacts}
                onConfirm={confirm}
                onKeepTalking={() => setDismissedAt(entries.length)}
              />
            ) : null
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={onbButton.ghost}>
          <ArrowLeft className="size-4" aria-hidden />
          {t.back}
        </button>
        <button type="button" onClick={onQuiz} className={onbButton.ghost}>
          {t.preferQuiz}
        </button>
      </div>

      {/* Mobile: sticky mic bar once the call is on, so the seller can answer while reading the transcript. */}
      {callOn ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-mk-line bg-mk-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <MicButton state={state} micBlocked={micBlocked} onPress={pressMic} t={t} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mk-text" aria-hidden>
                {callStateLabel(state, t)}
              </p>
              {elapsedMs !== null ? <p className="font-mk-mono text-xs tabular-nums text-mk-dim">{formatCallClock(elapsedMs)}</p> : null}
            </div>
            <button
              type="button"
              onClick={endCall}
              aria-label={t.endCall}
              className={cn("grid size-11 place-items-center rounded-full bg-red-600 text-white hover:bg-red-500")}
            >
              <PhoneOff className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
