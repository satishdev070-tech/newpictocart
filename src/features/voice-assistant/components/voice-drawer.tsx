"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Loader2, Mic, MicOff, RotateCcw, Send, Square, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { ASSISTANT_LOCALES, ASSISTANT_LOCALE_LABELS, speechTagFor, type AssistantLocale } from "../languages";
import type { AssistantActionView } from "../schemas";
import type { PublicError } from "@/lib/errors";
import {
  applyVoiceAssistantActionAction,
  dismissVoiceAssistantActionAction,
  resumeVoiceAssistantAction,
  undoVoiceAssistantActionAction,
  voiceAssistantTurnAction,
} from "../actions";
import { cancelSpeech, listen, speak, speechInputSupported, unlockSpeech, type ListenHandle } from "@/lib/speech/browser-speech";
import { ASSISTANT_SUGGESTIONS, nextStatus, type AssistantStatus, statusLabel } from "./status";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const PREFS_KEY = "pictocart.voice-assistant";
type Prefs = { locale?: AssistantLocale; muted?: boolean; review?: boolean; privacyOk?: boolean };
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...p }));
  } catch {
    /* private mode */
  }
}

const LISTEN_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in the browser's address bar, or type instead.",
  network: "Speech recognition needs an internet connection. Type instead, or try again.",
  unsupported: "Voice typing isn't supported in this browser. Type your message instead.",
  other: "I couldn't hear that. Try again or type it.",
};

const TURN_TIMEOUT_MS = 45_000;

let msgSeq = 0;
const mid = () => `m${++msgSeq}`;

export function VoiceDrawer({ open, storeName, autoListen, onClose }: { open: boolean; storeName: string; autoListen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [prefs] = useState(readPrefs);
  const [locale, setLocale] = useState<AssistantLocale>(() => (prefs.locale && (ASSISTANT_LOCALES as readonly string[]).includes(prefs.locale) ? prefs.locale : "en-IN"));
  const [muted, setMuted] = useState(!!prefs.muted);
  // Review before sending is the default: the merchant checks/edits the words, Enter sends.
  const [review, setReview] = useState(prefs.review !== false);
  const [privacyOk, setPrivacyOk] = useState(!!prefs.privacyOk);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [action, setAction] = useState<AssistantActionView | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [lastFailed, setLastFailed] = useState<{ text: string; mode: "voice" | "text" } | null>(null);
  const sessionRef = useRef<string | undefined>(undefined);
  const listenRef = useRef<ListenHandle | null>(null);
  const turnRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const micSupported = typeof window !== "undefined" && speechInputSupported();

  const go = useCallback((event: Parameters<typeof nextStatus>[1]) => setStatus((s) => nextStatus(s, event)), []);

  // Resume the member's latest conversation (last 7 days).
  useEffect(() => {
    void resumeVoiceAssistantAction({}).then((r) => {
      if (!r.ok || !r.data) return;
      sessionRef.current = r.data.sessionId;
      if (!prefs.locale) setLocale(r.data.locale);
      setMessages(r.data.messages.map((m) => ({ id: mid(), role: m.role, content: m.content })));
      const pending = r.data.actions.find((a) => a.status === "proposed" || a.status === "applied");
      if (pending) setAction(pending);
    });
  }, [prefs.locale]);

  useEffect(() => {
    // Braces matter: newer Chromium returns a Promise from scrollIntoView(), which React would
    // treat as an effect cleanup and crash on.
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, action, status]);

  const stopAll = useCallback(() => {
    listenRef.current?.abort();
    listenRef.current = null;
    cancelSpeech();
  }, []);

  useEffect(() => {
    if (!open) stopAll();
  }, [open, stopAll]);
  useEffect(() => () => stopAll(), [stopAll]);

  const send = useCallback(
    async (text: string, mode: "voice" | "text") => {
      const clean = text.trim();
      if (!clean) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setError("You're offline. Check your connection and try again.");
        setLastFailed({ text: clean, mode });
        go("fail");
        return;
      }
      const turn = ++turnRef.current;
      setError(null);
      setNotice(null);
      setDraft("");
      setLastFailed(null);
      setMessages((m) => [...m, { id: mid(), role: "user", content: clean }]);
      go("send");
      // Client-side ceiling: a stuck provider shows Retry instead of "Thinking…" forever.
      const r = await Promise.race([
        voiceAssistantTurnAction({ sessionId: sessionRef.current, text: clean, locale, inputMode: mode, page: pathname }),
        new Promise<{ ok: false; error: PublicError }>((resolve) =>
          setTimeout(() => resolve({ ok: false, error: { code: "INTERNAL", message: "That took too long. Tap Retry." } }), TURN_TIMEOUT_MS),
        ),
      ]);
      if (turn !== turnRef.current) return; // cancelled / superseded
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        setLastFailed({ text: clean, mode });
        go("fail");
        return;
      }
      sessionRef.current = r.data.sessionId;
      setMessages((m) => [...m, { id: mid(), role: "assistant", content: r.data.reply }]);
      if (r.data.action) setAction(r.data.action);
      if (muted) return go("done");
      go("speak");
      await speak(r.data.reply, speechTagFor(r.data.locale));
      if (turn === turnRef.current) go("done");
    },
    [go, locale, muted, pathname],
  );

  const startListening = useCallback(() => {
    if (!micSupported) {
      setError(LISTEN_ERRORS.unsupported!);
      inputRef.current?.focus();
      return;
    }
    if (!privacyOk) return; // the notice's button calls this again
    turnRef.current++; // cancel any reply still being spoken
    cancelSpeech();
    unlockSpeech();
    setError(null);
    setDraft("");
    go("listen");
    listenRef.current = listen(speechTagFor(locale), {
      onInterim: (t) => setDraft(t),
      onSpeechEnd: () => go("transcribe"),
      onFinal: (t) => {
        listenRef.current = null;
        if (!t) {
          setNotice("I didn't catch anything. Tap the mic and speak, or type below.");
          return go("done");
        }
        setDraft(t);
        if (review) {
          go("done");
          inputRef.current?.focus();
          return;
        }
        void send(t, "voice");
      },
      onError: (reason) => {
        listenRef.current = null;
        if (reason === "aborted") return go("done");
        setError(LISTEN_ERRORS[reason] ?? LISTEN_ERRORS.other!);
        go("fail");
      },
    });
  }, [go, locale, micSupported, privacyOk, review, send]);

  // Opening the drawer from the mic button starts listening right away (once privacy is accepted).
  const autoRef = useRef(false);
  useEffect(() => {
    if (open && autoListen && privacyOk && !autoRef.current) {
      autoRef.current = true;
      startListening();
    }
    if (!open) autoRef.current = false;
  }, [open, autoListen, privacyOk, startListening]);

  const cancel = () => {
    turnRef.current++;
    stopAll();
    go("done");
  };

  const runAction = async (kind: "apply" | "undo" | "dismiss") => {
    if (!action) return;
    setActionBusy(true);
    setError(null);
    const fn = kind === "apply" ? applyVoiceAssistantActionAction : kind === "undo" ? undoVoiceAssistantActionAction : dismissVoiceAssistantActionAction;
    const r = await fn({ actionId: action.id });
    setActionBusy(false);
    if (!r.ok) return setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
    if (kind === "dismiss") return setAction(null);
    const data = r.data as { action: AssistantActionView; message: string };
    setAction(data.action);
    setNotice(data.message);
  };

  if (!open) return null;

  const busy = status === "thinking" || status === "transcribing";
  const listening = status === "listening";

  return (
    <div role="dialog" aria-modal="false" aria-label="Tara, Pictocart voice assistant" className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border border-border bg-surface text-foreground shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(400px,calc(100vw-3rem))] sm:rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${listening ? "bg-error text-white" : "bg-foreground text-surface"}`}>
          <Mic aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-semibold">Tara</p>
          <p className="truncate text-caption text-muted" aria-live="polite">
            {statusLabel(status)} · {storeName}
          </p>
        </div>
        <label className="sr-only" htmlFor="va-locale">
          Language
        </label>
        <select
          id="va-locale"
          value={locale}
          onChange={(e) => {
            const l = e.target.value as AssistantLocale;
            setLocale(l);
            writePrefs({ locale: l });
          }}
          className="h-8 max-w-[6.5rem] shrink-0 rounded-lg border border-border bg-surface px-1.5 text-caption"
        >
          {ASSISTANT_LOCALES.map((l) => (
            <option key={l} value={l}>
              {ASSISTANT_LOCALE_LABELS[l].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setMuted((m) => {
              writePrefs({ muted: !m });
              if (!m) cancelSpeech();
              return !m;
            });
          }}
          aria-pressed={muted}
          aria-label={muted ? "Turn spoken replies on" : "Turn spoken replies off"}
          className="grid size-8 place-items-center rounded-lg hover:bg-surface-secondary"
        >
          {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            turnRef.current++;
            stopAll();
            setStatus("idle");
            onClose();
          }}
          aria-label="Close Tara" className="grid size-8 place-items-center rounded-lg hover:bg-surface-secondary">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-small">
        {!privacyOk && micSupported ? (
          <div className="rounded-lg border border-border bg-surface-secondary p-3 text-caption">
            <p className="font-semibold text-foreground">Before you talk</p>
            <p className="mt-1 text-muted">
              Your browser turns your speech into text (Chrome uses Google&apos;s speech service for this). Pictocart never records or stores your voice; only the text of the conversation is saved to your account so you can continue it later.
            </p>
            <button
              type="button"
              onClick={() => {
                setPrivacyOk(true);
                writePrefs({ privacyOk: true });
                setTimeout(() => startListening(), 0);
              }}
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-caption font-semibold text-surface"
            >
              <Mic aria-hidden className="size-3.5" /> Allow and start talking
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-caption text-muted">Hold a conversation in English, हिन्दी or Hinglish. Try:</p>
            <div className="flex flex-wrap gap-1.5">
              {(ASSISTANT_SUGGESTIONS[locale] ?? []).map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => void send(s, "text")} className="rounded-full border border-border px-2.5 py-1 text-caption hover:bg-surface-secondary disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ol className="space-y-2" aria-label="Conversation">
          {messages.map((m) => (
            <li key={m.id} className={m.role === "user" ? "ml-8 rounded-xl rounded-br-sm bg-foreground px-3 py-2 text-surface" : "mr-8 rounded-xl rounded-bl-sm bg-surface-secondary px-3 py-2"}>
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.content}
            </li>
          ))}
        </ol>

        {action && action.status !== "rejected" ? (
          <div className="rounded-xl border border-border p-3" aria-label="Suggested change">
            <p className="text-caption font-semibold">{action.title}</p>
            <div className="mt-2 flex items-center gap-2 text-caption text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="size-4 rounded border border-border" style={{ background: action.before ?? "transparent" }} aria-hidden /> {action.before ?? "—"}
              </span>
              <span aria-hidden>→</span>
              <span className="inline-flex items-center gap-1">
                <span className="size-4 rounded border border-border" style={{ background: action.after }} aria-hidden /> {action.after}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {action.status === "proposed" ? (
                <>
                  <button type="button" disabled={actionBusy} onClick={() => void runAction("apply")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-caption font-semibold text-white disabled:opacity-60">
                    {actionBusy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Check aria-hidden className="size-3.5" />} Apply to draft
                  </button>
                  <button type="button" disabled={actionBusy} onClick={() => void runAction("dismiss")} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-caption">
                    Not now
                  </button>
                </>
              ) : null}
              {action.status === "applied" ? (
                <>
                  <button type="button" disabled={actionBusy} onClick={() => void runAction("undo")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-caption font-semibold disabled:opacity-60">
                    {actionBusy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Undo2 aria-hidden className="size-3.5" />} Undo
                  </button>
                  <a href="/dashboard/theme" className="inline-flex min-h-9 items-center rounded-lg px-2 text-caption font-semibold text-accent underline-offset-2 hover:underline">
                    Preview in theme editor
                  </a>
                </>
              ) : null}
              {action.status === "undone" ? <p className="text-caption text-muted">Undone.</p> : null}
            </div>
          </div>
        ) : null}

        {notice ? (
          <p role="status" className="text-caption text-success">
            {notice}
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/25 bg-error/5 px-3 py-2 text-caption text-error">
            <span className="flex-1">{error}</span>
            {lastFailed ? (
              <button type="button" onClick={() => void send(lastFailed.text, lastFailed.mode)} className="inline-flex shrink-0 items-center gap-1 font-semibold underline">
                <RotateCcw aria-hidden className="size-3" /> Retry
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft, "text");
        }}
      >
        <button
          type="button"
          onClick={() => (listening ? listenRef.current?.stop() : busy || status === "speaking" ? cancel() : startListening())}
          aria-label={listening ? "Stop listening" : busy || status === "speaking" ? "Cancel" : "Start talking"}
          aria-pressed={listening}
          disabled={!micSupported}
          title={micSupported ? undefined : LISTEN_ERRORS.unsupported}
          className={`grid size-11 shrink-0 place-items-center rounded-full text-white transition-colors disabled:bg-border disabled:text-muted ${listening ? "animate-pulse bg-error" : "bg-foreground"}`}
        >
          {!micSupported ? <MicOff aria-hidden className="size-5" /> : listening || busy || status === "speaking" ? <Square aria-hidden className="size-4" /> : <Mic aria-hidden className="size-5" />}
        </button>
        <label htmlFor="va-text" className="sr-only">
          Message
        </label>
        <textarea
          id="va-text"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft, "text");
            }
          }}
          rows={1}
          maxLength={600}
          placeholder={listening ? "Listening…" : "Speak or type…"}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-small"
        />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
        </button>
      </form>
      <label className="flex items-center gap-2 px-4 pb-3 text-caption text-muted">
        <input
          type="checkbox"
          checked={review}
          onChange={(e) => {
            setReview(e.target.checked);
            writePrefs({ review: e.target.checked });
          }}
        />
        Check and edit my words before sending (Enter sends)
      </label>
    </div>
  );
}
