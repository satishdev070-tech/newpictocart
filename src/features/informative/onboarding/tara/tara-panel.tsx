"use client";

import { recognitionLang } from "@/features/onboarding/voice/browser-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { onbButton } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { CallPanel } from "@/features/start/components/voice/call-panel";
import { TranscriptPanel } from "@/features/start/components/voice/transcript-panel";
import { voiceUiCopy } from "@/features/start/components/voice/voice-copy";
import { makeEntry, entriesToHistory, type TranscriptEntry } from "@/features/onboarding/voice/transcript";
import { playDetached, sayDetached, useTaraCall, type TaraTurnOutcome } from "@/features/onboarding/voice/use-tara-call";
import { informativeTaraTurnAction } from "./actions";
import { EMPTY_INFO_FACTS, normalizeInfoFacts, type InfoVoiceFacts } from "./facts";
import { infoTaraGreeting } from "./lines";
import { infoCopy } from "@/features/start/i18n/info-copy";

const STORE_KEY = "pictocart.start.informative.tara.v1";

type Saved = { facts: InfoVoiceFacts; turns: { role: "seller" | "tara"; text: string }[] };

function readSaved(): Saved | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Saved>;
    return { facts: normalizeInfoFacts(v.facts), turns: Array.isArray(v.turns) ? v.turns.slice(-40) : [] };
  } catch {
    return null;
  }
}

/**
 * "Fill this with Tara" on the Informative Step 1. Same call experience as the store journey
 * (browser speech, review-before-send, female voice), but Tara's facts pre-fill the form below,
 * which stays the confirmation: the owner checks it and presses Continue.
 */
export function TaraInfoPanel({ locale, onFacts }: { locale: string; onFacts: (facts: InfoVoiceFacts, done: boolean) => void }) {
  const t = voiceUiCopy(locale);
  const tb = infoCopy(locale).basic;
  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typingOpen, setTypingOpen] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<TranscriptEntry[]>(() => [makeEntry("tara", infoTaraGreeting(locale), null)]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entriesRef = useRef(entries);
  const factsRef = useRef<InfoVoiceFacts>({ ...EMPTY_INFO_FACTS });

  // Resume this tab's conversation (sessionStorage; never sent anywhere else).
  useEffect(() => {
    const saved = readSaved();
    if (!saved?.turns.length) return;
    factsRef.current = saved.facts;
    const restored = [makeEntry("tara", infoTaraGreeting(locale), null), ...saved.turns.map((turn) => makeEntry(turn.role, turn.text, null))];
    entriesRef.current = restored;
    const id = setTimeout(() => setEntries(restored), 0);
    return () => clearTimeout(id);
  }, [locale]);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const save = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ facts: factsRef.current, turns: entriesToHistory(entriesRef.current).slice(1) }));
    } catch {
      /* private mode */
    }
  }, []);

  const append = useCallback((added: TranscriptEntry[]) => {
    const next = [...entriesRef.current, ...added];
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const runTurn = useCallback(
    async (text: string): Promise<TaraTurnOutcome> => {
      append([makeEntry("seller", text)]);
      setBusy(true);
      try {
        const r = await informativeTaraTurnAction({
          locale,
          text,
          factsJson: JSON.stringify(factsRef.current),
          historyJson: JSON.stringify(entriesToHistory(entriesRef.current.slice(0, -1))),
        });
        if (!r.ok) {
          append([makeEntry("system", r.error.fieldErrors?._form?.[0] ?? r.error.message)]);
          return { outcome: "error", speech: null };
        }
        factsRef.current = r.data.facts;
        append([makeEntry("tara", r.data.reply)]);
        save();
        onFacts(r.data.facts, r.data.done);
        const speech = r.data.audioBase64 && r.data.audioMimeType ? { audioBase64: r.data.audioBase64, mimeType: r.data.audioMimeType } : null;
        return { outcome: "heard", speech, text: r.data.reply };
      } catch {
        append([makeEntry("system", t.didntCatch)]);
        return { outcome: "error", speech: null };
      } finally {
        setBusy(false);
      }
    },
    [append, locale, onFacts, save, t.didntCatch],
  );

  const openTyping = useCallback(() => {
    setTypingOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const call = useTaraCall({
    speak: voiceOn,
    locale,
    // Browser recognition is the listener; without it the owner types (no audio upload here).
    onTake: async () => ({ outcome: "stt_unavailable", speech: null }),
    onHeard: runTurn,
    reviewBeforeSend: true,
    greeting: async () => ({ text: infoTaraGreeting(locale), speech: null }),
    onMicFailed: (reason) => {
      setMicNotice(reason === "denied" ? t.micBlocked : t.micUnsupported);
      setStartedAt(null);
      openTyping();
    },
  });

  function sendText(text: string) {
    if (call.active) {
      void call.sendTyped(() => runTurn(text));
      return;
    }
    void runTurn(text).then((o) => {
      if (!voiceOn) return;
      if (o.speech) playDetached(o.speech);
      else if (o.text) sayDetached(o.text, locale);
    });
  }

  if (!open) {
    return (
      <div className="mb-6 flex flex-col items-start gap-3 rounded-[var(--r-lg)] border border-mk-accent/30 bg-mk-elev-1 p-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#ea580c_100%)]">
          <Sparkles className="size-4 text-mk-accent-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mk-text">{tb.taraTitle}</p>
          <p className="text-sm text-mk-muted">{tb.taraBody}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={cn(onbButton.primary, "min-h-11")}>
          {tb.taraCta}
        </button>
      </div>
    );
  }

  const elapsed = startedAt !== null ? Math.max(0, (now || startedAt) - startedAt) : null;
  return (
    <section aria-label={tb.taraCta} className="mb-8 grid gap-4 lg:grid-cols-2">
      <CallPanel
          voiceLang={recognitionLang(locale)}
        t={t}
        view={call.view}
        active={call.active}
        elapsedMs={elapsed}
        micNotice={micNotice}
        busy={busy}
        inputRef={inputRef}
        typingOpen={typingOpen || call.view.suggestTyping}
        meterRef={call.meterRef}
        onTypingOpen={openTyping}
        onStart={() => {
          const s = Date.now();
          setStartedAt(s);
          setNow(s);
          setMicNotice(null);
          void call.start();
        }}
        onTap={call.tap}
        onMute={call.toggleMute}
        onEndCall={() => {
          call.end();
          setStartedAt(null);
        }}
        onSendText={sendText}
        review={call.review}
        onConfirmReview={call.confirmReview}
        onRetake={call.retake}
      />
      <TranscriptPanel
        t={t}
        entries={entries}
        liveCaption={call.active ? call.caption : ""}
        liveLabel={t.heardLive}
        thinking={busy}
        onClear={() => {
          const fresh = [makeEntry("tara", infoTaraGreeting(locale), null)];
          entriesRef.current = fresh;
          factsRef.current = { ...EMPTY_INFO_FACTS };
          setEntries(fresh);
          save();
        }}
        footer={
          <label className="mt-2 flex items-center gap-2 text-xs text-mk-muted">
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} /> {tb.taraSpeaks}
          </label>
        }
      />
    </section>
  );
}
