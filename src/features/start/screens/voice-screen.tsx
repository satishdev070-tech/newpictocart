"use client";

import { recognitionLang } from "@/features/onboarding/voice/browser-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { OnbCard, OnbSub, onbButton } from "@/components/onboarding-ui";
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
import { fileExtension } from "@/features/onboarding/voice/use-voice-recorder";
import { taraGreetingAction } from "@/features/onboarding/voice/actions";
import { taraGreetingText, type TaraGreetingKind } from "@/features/onboarding/voice/greetings";
import {
  playDetached,
  sayDetached,
  useTaraCall,
  type TaraLine,
  type TaraSpeech,
  type TaraTurnOutcome,
} from "@/features/onboarding/voice/use-tara-call";
import { CallOrb, CallPanel, EndCallButton, MuteButton, callStateLabel } from "../components/voice/call-panel";
import { ConfirmCard } from "../components/voice/confirm-card";
import { TranscriptPanel } from "../components/voice/transcript-panel";
import { voiceUiCopy, type VoiceUiCopy } from "../components/voice/voice-copy";

/** Copy for browser speech; optional until every locale ships the keys (English fallback). */
type SpeechCopy = { heardLive: string; sttUnavailable: string; notHeard: string };
function speechCopy(t: VoiceUiCopy): SpeechCopy {
  const x = t as VoiceUiCopy & Partial<SpeechCopy>;
  return {
    heardLive: x.heardLive ?? "Hearing…",
    sttUnavailable: x.sttUnavailable ?? "Voice recognition isn't available right now — please type your answer.",
    notHeard: x.notHeard ?? "I didn't catch that — please say it again.",
  };
}

/** Server says its speech-to-text provider is down (quota/auth/outage): don't retry audio. */
function isSttUnavailable(error: { code: string; fieldErrors?: Record<string, string[]> }): boolean {
  return error.code === "VALIDATION" && Boolean(error.fieldErrors?.reason?.includes("stt_unavailable"));
}

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

/** Greeting audio per locale+kind for this page session (one TTS call, replayed on restart). */
const greetingCache = new Map<string, Promise<TaraSpeech | null>>();

function fetchGreetingSpeech(locale: string, kind: TaraGreetingKind): Promise<TaraSpeech | null> {
  const key = `${locale}:${kind}`;
  const hit = greetingCache.get(key);
  if (hit) return hit;
  const fd = new FormData();
  fd.set("locale", locale);
  fd.set("kind", kind);
  const pending = taraGreetingAction(null, fd)
    .then((res) => (res?.ok && res.data.audioBase64 && res.data.mimeType ? { audioBase64: res.data.audioBase64, mimeType: res.data.mimeType } : null))
    .catch(() => null)
    .then((speech) => {
      if (!speech) greetingCache.delete(key);
      return speech;
    });
  greetingCache.set(key, pending);
  return pending;
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
  const sc = speechCopy(t);
  const [facts, setFacts] = useState<VoiceFacts>(() => initialFacts(draft));
  const [entries, setEntries] = useState<TranscriptEntry[]>(() => {
    const saved = entriesFromTurns(draft.voice.turns ?? []);
    return saved.length ? saved : [makeEntry("tara", taraGreetingText(draft.locale), null)];
  });
  const [busy, setBusy] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [endedElapsed, setEndedElapsed] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [typingOpen, setTypingOpen] = useState(false);
  /** Transcript length when the seller tapped "Keep talking" (card hides until the next turn). */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  // Latest transcript/facts for async turns started by the call loop (avoids stale closures).
  const entriesRef = useRef(entries);
  const factsRef = useRef(facts);
  useEffect(() => {
    entriesRef.current = entries;
    factsRef.current = facts;
  }, [entries, facts]);

  useEffect(() => {
    if (callStartedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [callStartedAt]);

  const appendEntries = useCallback((added: TranscriptEntry[]) => {
    const next = [...entriesRef.current, ...added];
    entriesRef.current = next;
    setEntries(next);
    return next;
  }, []);

  /** One server turn (audio take or typed text). Resolves with what the call loop needs next. */
  const runTurn = useCallback(
    async (payload: { text?: string; audio?: Blob }): Promise<TaraTurnOutcome> => {
      const fd = new FormData();
      fd.set("locale", draft.locale);
      fd.set("factsJson", JSON.stringify(factsRef.current));
      fd.set("historyJson", JSON.stringify(entriesToHistory(entriesRef.current)));
      if (payload.text) fd.set("text", payload.text);
      if (payload.audio && payload.audio.size > 0) {
        const mime = payload.audio.type || "audio/webm";
        fd.set("audio", payload.audio, `turn.${fileExtension(mime)}`);
      }
      setBusy(true);
      try {
        const result = await startVoiceTurnAction(null, fd);
        if (!result) return { outcome: "error", speech: null };
        if (!result.ok) {
          // Provider down: the call panel shows one notice and opens typing (no transcript spam).
          if (payload.audio && isSttUnavailable(result.error)) return { outcome: "stt_unavailable", speech: null };
          appendEntries([makeEntry("system", result.error.fieldErrors?._form?.[0] ?? result.error.message)]);
          return { outcome: "error", speech: null };
        }
        const data = result.data;
        const nextEntries = appendEntries(turnToEntries(data, Date.now(), t.didntCatch));
        if (data.heard === false) return { outcome: "empty", speech: null };
        const nextFacts = normalizeFacts(data.facts);
        factsRef.current = nextFacts;
        setFacts(nextFacts);
        onFacts(nextFacts, data.done, entriesToHistory(nextEntries));
        const speech = data.audioBase64 && data.audioMimeType ? { audioBase64: data.audioBase64, mimeType: data.audioMimeType } : null;
        return { outcome: "heard", speech, text: data.reply };
      } catch {
        appendEntries([makeEntry("system", t.didntCatch)]);
        return { outcome: "error", speech: null };
      } finally {
        setBusy(false);
      }
    },
    [appendEntries, draft.locale, onFacts, t.didntCatch],
  );

  const openTyping = useCallback(() => {
    setTypingOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  /** Spoken opener: welcome on a fresh transcript, a short "welcome back" when answers exist. */
  const greeting = useCallback(async (): Promise<TaraLine> => {
    const hasAnswers = entriesRef.current.some((e) => e.role === "seller");
    const kind: TaraGreetingKind = hasAnswers ? "resume" : "welcome";
    const text = taraGreetingText(draft.locale, kind);
    const last = [...entriesRef.current].reverse().find((e) => e.role !== "system");
    if (last?.text !== text) appendEntries([makeEntry("tara", text)]);
    // No server audio (TTS down) → the call speaks `text` with the browser voice.
    return { text, speech: await fetchGreetingSpeech(draft.locale, kind) };
  }, [appendEntries, draft.locale]);

  const call = useTaraCall({
    speak: voiceEnabled,
    locale: draft.locale,
    onTake: async (audio) => {
      const o = await runTurn({ audio });
      if (o.outcome === "stt_unavailable") openTyping();
      return o;
    },
    onHeard: (text) => runTurn({ text }),
    // The seller sees and can edit what was heard; Tara gets it on Enter / Send.
    reviewBeforeSend: true,
    greeting,
    onMicFailed: (reason) => {
      setMicNotice(reason === "denied" ? t.micBlocked : t.micUnsupported);
      setCallStartedAt(null);
      setEndedElapsed(null);
      openTyping();
    },
  });
  const { view } = call;

  const elapsedMs = callStartedAt !== null ? Math.max(0, (now || callStartedAt) - callStartedAt) : endedElapsed;

  function startCall() {
    const start = Date.now();
    setCallStartedAt(start);
    setNow(start);
    setEndedElapsed(null);
    setMicNotice(null);
    void call.start(); // inside the tap: unlocks audio + asks for the mic
  }

  function endCall() {
    call.end();
    if (callStartedAt !== null) setEndedElapsed(Math.max(0, Date.now() - callStartedAt));
    setCallStartedAt(null);
  }

  function sendText(text: string) {
    if (call.active) {
      void call.sendTyped(() => runTurn({ text }));
      return;
    }
    void runTurn({ text }).then((o) => {
      if (!voiceEnabled) return;
      if (o.speech) playDetached(o.speech);
      else if (o.text) sayDetached(o.text, draft.locale);
    });
  }

  function clearTranscript() {
    const fresh = [makeEntry("tara", taraGreetingText(draft.locale))];
    entriesRef.current = fresh;
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
  const sttNotice = view.sttDown && view.listener === "none" ? sc.sttUnavailable : null;
  const notice = micNotice ?? sttNotice ?? (call.active && view.notHeard ? sc.notHeard : null) ?? (view.suggestTyping ? t.typeSuggestion : null);

  return (
    <section className="mx-auto w-full max-w-6xl pb-24 lg:pb-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <CallPanel
          voiceLang={recognitionLang(draft.locale)}
          t={t}
          view={view}
          active={call.active}
          elapsedMs={elapsedMs}
          micNotice={notice}
          busy={busy}
          inputRef={inputRef}
          typingOpen={typingOpen || view.suggestTyping}
          meterRef={call.meterRef}
          onTypingOpen={openTyping}
          onStart={startCall}
          onTap={call.tap}
          onMute={call.toggleMute}
          onEndCall={endCall}
          onSendText={sendText}
          review={call.review}
          onConfirmReview={call.confirmReview}
          onRetake={call.retake}
        />
        <TranscriptPanel
          t={t}
          entries={entries}
          liveCaption={call.active ? call.caption : ""}
          liveLabel={sc.heardLive}
          thinking={busy}
          onClear={clearTranscript}
          footer={
            showConfirm ? (
              <ConfirmCard
                t={t}
                locale={draft.locale}
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

      {/* Mobile: sticky call bar while the call runs, so the seller can read the transcript and still control it. */}
      {call.active ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-mk-line bg-mk-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <CallOrb view={view} active meterRef={call.meterRef} onStart={startCall} onTap={call.tap} t={t} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mk-text" aria-hidden>
                {callStateLabel(view, t)}
              </p>
              {elapsedMs !== null ? <p className="font-mk-mono text-xs tabular-nums text-mk-dim">{formatCallClock(elapsedMs)}</p> : null}
            </div>
            <MuteButton muted={view.muted} onToggle={call.toggleMute} t={t} />
            <EndCallButton onEnd={endCall} t={t} compact />
          </div>
        </div>
      ) : null}
    </section>
  );
}
