"use client";

import { useState, type FormEvent, type RefObject } from "react";
import { Keyboard, Mic, MicOff, PhoneOff, Send, Sparkles } from "lucide-react";
import { onbButton, onbField } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { formatCallClock } from "@/features/onboarding/voice/transcript";
import type { VoiceUiCopy } from "./voice-copy";

export type CallState = "ready" | "listening" | "thinking" | "speaking";

export function callStateLabel(state: CallState, t: VoiceUiCopy): string {
  if (state === "listening") return t.stateListening;
  if (state === "thinking") return t.stateThinking;
  if (state === "speaking") return t.stateSpeaking;
  return t.stateReady;
}

/** Big round tap-to-speak button (orange on dark, pulsing ring while listening). */
export function MicButton({
  state,
  micBlocked,
  onPress,
  t,
  size = "lg",
}: {
  state: CallState;
  micBlocked: boolean;
  onPress: () => void;
  t: VoiceUiCopy;
  size?: "lg" | "sm";
}) {
  const listening = state === "listening";
  const dim = size === "lg" ? "size-28 sm:size-32" : "size-14";
  return (
    <span className={cn("relative inline-grid place-items-center", dim)}>
      {listening ? (
        <>
          <span aria-hidden className="absolute inset-0 rounded-full bg-mk-accent/35 motion-safe:animate-ping" />
          <span aria-hidden className="absolute -inset-3 rounded-full border-2 border-mk-accent/40 motion-safe:animate-pulse" />
        </>
      ) : null}
      <button
        type="button"
        onClick={onPress}
        disabled={micBlocked || state === "thinking"}
        aria-pressed={listening}
        aria-label={micBlocked ? t.micBlocked : listening ? t.tapToStop : t.tapToStart}
        className={cn(
          "relative grid place-items-center rounded-full bg-mk-accent text-mk-accent-ink shadow-[0_18px_50px_-12px_var(--accent-glow)] transition-[transform,background-color] duration-200 hover:bg-mk-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
          dim,
          listening && "scale-105",
        )}
      >
        {micBlocked ? (
          <MicOff className={size === "lg" ? "size-10" : "size-6"} aria-hidden />
        ) : (
          <Mic className={size === "lg" ? "size-10" : "size-6"} aria-hidden />
        )}
      </button>
    </span>
  );
}

export function CallPanel({
  t,
  state,
  callOn,
  elapsedMs,
  micBlocked,
  micNotice,
  busy,
  inputRef,
  typingOpen,
  onTypingOpen,
  onMic,
  onEndCall,
  onSendText,
}: {
  t: VoiceUiCopy;
  state: CallState;
  /** Call started (timer running). */
  callOn: boolean;
  /** Elapsed call time; null before the first start. */
  elapsedMs: number | null;
  micBlocked: boolean;
  micNotice: string | null;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  typingOpen: boolean;
  onTypingOpen: () => void;
  onMic: () => void;
  onEndCall: () => void;
  onSendText: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    onSendText(v);
    setText("");
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-5 shadow-[var(--brand-shadow-card)] sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-mk-text">
        <span className="grid size-7 place-items-center rounded-full bg-mk-accent-tint text-mk-accent">
          <Mic className="size-4" aria-hidden />
        </span>
        {t.liveCall}
      </div>

      <div className="flex items-center gap-3 rounded-[var(--r-md)] border border-mk-line bg-mk-elev-2 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#ea580c_100%)]">
          <Sparkles className="size-4 text-mk-accent-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-mk-text">
            {t.agentName} · <span className="font-medium text-mk-muted">{t.agentRole}</span>
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mk-mono text-[10px] uppercase tracking-[0.12em]",
            callOn ? "border-emerald-500/40 text-emerald-300" : "border-mk-line-strong text-mk-muted",
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", callOn ? "bg-emerald-400" : "bg-mk-dim")} />
          {callOn ? t.statusOnCall : t.statusIdle}
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <MicButton state={state} micBlocked={micBlocked} onPress={onMic} t={t} />
        <p className="mt-2 text-base font-semibold text-mk-text" aria-live="polite">
          {callStateLabel(state, t)}
        </p>
        <p className="text-xs text-mk-dim">{state === "listening" ? t.tapToStop : t.tapToStart}</p>
        {elapsedMs !== null ? (
          <p className="font-mk-mono text-sm tabular-nums text-mk-muted" aria-label="Call time">
            {callOn ? formatCallClock(elapsedMs) : `${t.callEnded} · ${formatCallClock(elapsedMs)}`}
          </p>
        ) : null}
        {callOn ? (
          <button
            type="button"
            onClick={onEndCall}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <PhoneOff className="size-4" aria-hidden />
            {t.endCall}
          </button>
        ) : null}
      </div>

      {micNotice ? (
        <p role="alert" className="rounded-[var(--r-sm)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {micNotice}
        </p>
      ) : null}

      {typingOpen ? (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="tara-type" className="sr-only">
            {t.typeInstead}
          </label>
          <input
            id="tara-type"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.typePlaceholder}
            maxLength={1000}
            autoComplete="off"
            className={cn(onbField, "min-h-11 flex-1")}
          />
          <button type="submit" disabled={busy || !text.trim()} className={cn(onbButton.primary, "min-h-11 px-4")} aria-label={t.send}>
            <Send className="size-4" aria-hidden />
          </button>
        </form>
      ) : (
        <button type="button" onClick={onTypingOpen} className={cn(onbButton.ghost, "self-center")}>
          <Keyboard className="size-4" aria-hidden />
          {t.typeInstead}
        </button>
      )}

      <div className="rounded-[var(--r-md)] border border-mk-line bg-mk-bg/40 p-4">
        <p className="mb-2 font-mk-mono text-[11px] uppercase tracking-[0.16em] text-mk-accent">{t.tipsTitle}</p>
        <ul className="space-y-1.5 text-sm text-mk-muted">
          {t.tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-mk-dim" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
