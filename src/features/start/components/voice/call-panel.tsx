"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Check, Keyboard, Mic, MicOff, PhoneOff, RotateCcw, Send, Sparkles } from "lucide-react";
import { onbButton, onbField } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { formatCallClock } from "@/features/onboarding/voice/transcript";
import { callUiState, type CallUiState } from "@/features/onboarding/voice/call-machine";
import type { TaraCallView } from "@/features/onboarding/voice/use-tara-call";
import type { VoiceUiCopy } from "./voice-copy";

export type CallState = CallUiState;

export function callStateLabel(view: TaraCallView, t: VoiceUiCopy): string {
  if (view.phase === "connecting") return t.stateConnecting;
  if (view.phase === "reviewing") return t.stateReviewing;
  const state = callUiState(view);
  // No way to hear this call (server STT down, no browser recognition): Tara talks, seller types.
  if (state === "listening" && view.listener === "none") return t.typeInstead;
  if (state === "listening") return view.muted ? t.stateMuted : t.stateListening;
  if (state === "thinking") return t.stateThinking;
  if (state === "speaking") return t.stateSpeaking;
  return t.stateReady;
}

function callHint(view: TaraCallView, t: VoiceUiCopy): string {
  if (view.paused) return t.hintPaused;
  if (view.phase === "speaking") return t.hintSpeaking;
  if (view.phase === "reviewing") return t.hintReviewing;
  if (view.phase === "listening") {
    if (view.listener === "none") return ""; // the notice below explains it
    return view.muted ? t.hintMuted : t.hintListening;
  }
  if (view.phase === "thinking" || view.phase === "connecting") return t.hintThinking;
  return "";
}

type MeterRef = (el: HTMLElement | null) => void | (() => void);

/**
 * Tara's orb. Before the call: the big "Start conversation" button. During the call: tap to
 * interrupt (while Tara speaks) or send early (while listening); the outer ring follows the
 * live mic level through the `--lvl` CSS variable the call hook writes.
 */
export function CallOrb({
  view,
  active,
  meterRef,
  onStart,
  onTap,
  t,
  size = "lg",
}: {
  view: TaraCallView;
  active: boolean;
  meterRef: MeterRef;
  onStart: () => void;
  onTap: () => void;
  t: VoiceUiCopy;
  size?: "lg" | "sm";
}) {
  const state = callUiState(view);
  const listening = state === "listening" && !view.muted && view.listener !== "none";
  const dim = size === "lg" ? "size-28 sm:size-32" : "size-14";
  const icon = size === "lg" ? "size-10" : "size-6";
  const label = !active ? t.startConversation : state === "speaking" ? t.orbInterrupt : t.orbSendNow;

  return (
    <span className={cn("relative inline-grid place-items-center", dim)}>
      {/* Live level ring (listening) */}
      <span
        ref={meterRef}
        aria-hidden
        style={{ transform: "scale(calc(1 + var(--lvl, 0) * 0.45))" }}
        className={cn(
          "absolute inset-0 rounded-full bg-mk-accent/30 transition-[transform,opacity] duration-100 ease-out",
          listening ? "opacity-100" : "opacity-0",
        )}
      />
      {state === "speaking" ? (
        <span aria-hidden className="absolute -inset-3 rounded-full border-2 border-mk-accent/50 motion-safe:animate-pulse" />
      ) : null}
      {state === "thinking" ? (
        <span
          aria-hidden
          className="absolute -inset-2 rounded-full border-2 border-transparent border-t-mk-accent motion-safe:animate-spin"
        />
      ) : null}
      <button
        type="button"
        onClick={active ? onTap : onStart}
        disabled={active && (state === "thinking" || view.paused)}
        aria-label={label}
        title={label}
        className={cn(
          "relative grid place-items-center rounded-full text-mk-accent-ink shadow-[0_18px_50px_-12px_var(--accent-glow)] transition-[transform,background-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-accent active:scale-95 disabled:cursor-not-allowed",
          "bg-[radial-gradient(circle_at_35%_30%,#fff7ed_0,#fdba74_24%,var(--mk-accent)_62%,var(--mk-accent-hover)_100%)]",
          dim,
          state === "speaking" && "motion-safe:animate-[startBreathe_2.4s_ease-in-out_infinite]",
        )}
      >
        {!active ? (
          <Mic className={icon} aria-hidden />
        ) : view.muted ? (
          <MicOff className={icon} aria-hidden />
        ) : state === "speaking" ? (
          <Sparkles className={icon} aria-hidden />
        ) : (
          <Mic className={icon} aria-hidden />
        )}
      </button>
    </span>
  );
}

/** Round mute toggle used on the panel and the mobile bar. */
export function MuteButton({ muted, onToggle, t, className }: { muted: boolean; onToggle: () => void; t: VoiceUiCopy; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? t.unmute : t.mute}
      title={muted ? t.unmute : t.mute}
      className={cn(
        "grid size-11 place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
        muted ? "border-amber-400/60 bg-amber-500/15 text-amber-200" : "border-mk-line-strong text-mk-text hover:bg-white/[0.06]",
        className,
      )}
    >
      {muted ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
    </button>
  );
}

export function EndCallButton({ onEnd, t, compact = false }: { onEnd: () => void; t: VoiceUiCopy; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onEnd}
      aria-label={t.endCall}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400",
        compact ? "size-11" : "min-h-11 px-5 text-sm",
      )}
    >
      <PhoneOff className={compact ? "size-5" : "size-4"} aria-hidden />
      {compact ? null : t.endCall}
    </button>
  );
}

export function CallPanel({
  t,
  view,
  active,
  elapsedMs,
  micNotice,
  busy,
  inputRef,
  typingOpen,
  meterRef,
  onTypingOpen,
  onStart,
  onTap,
  onMute,
  onEndCall,
  onSendText,
  review,
  onConfirmReview,
  onRetake,
}: {
  t: VoiceUiCopy;
  view: TaraCallView;
  /** Words heard in this turn, waiting for the seller's OK (null when not reviewing). */
  review?: string | null;
  onConfirmReview?: (text: string) => void;
  onRetake?: () => void;
  /** Call running (mic open or opening). */
  active: boolean;
  /** Elapsed call time; null before the first start. */
  elapsedMs: number | null;
  micNotice: string | null;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  typingOpen: boolean;
  meterRef: MeterRef;
  onTypingOpen: () => void;
  onStart: () => void;
  onTap: () => void;
  onMute: () => void;
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

  const hint = active ? callHint(view, t) : t.micExplainer;

  return (
    <div className="flex flex-col gap-5 rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-5 shadow-[var(--brand-shadow-card)] sm:p-6">
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
            active ? "border-emerald-500/40 text-emerald-300" : "border-mk-line-strong text-mk-muted",
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-mk-dim")} />
          {active ? t.statusOnCall : t.statusIdle}
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CallOrb view={view} active={active} meterRef={meterRef} onStart={onStart} onTap={onTap} t={t} />
        {active ? (
          <p className="mt-2 text-base font-semibold text-mk-text" aria-live="polite">
            {callStateLabel(view, t)}
          </p>
        ) : (
          <button type="button" onClick={onStart} className={cn(onbButton.primary, "mt-2")}>
            <Mic className="size-4" aria-hidden />
            {elapsedMs !== null ? t.restart : t.startConversation}
          </button>
        )}
        {hint ? <p className="max-w-xs text-sm text-mk-muted">{hint}</p> : null}
        {elapsedMs !== null ? (
          <p className="font-mk-mono text-sm tabular-nums text-mk-muted" aria-label="Call time">
            {active ? formatCallClock(elapsedMs) : `${t.callEnded} · ${formatCallClock(elapsedMs)}`}
          </p>
        ) : null}
        {active && view.phase === "listening" && view.listener === "browser" && !view.muted ? (
          <button type="button" onClick={onTap} className={cn(onbButton.primary, "min-h-11 px-6")}>
            <Check className="size-4" aria-hidden />
            {t.doneSpeaking}
          </button>
        ) : null}
        {active ? (
          <div className="flex items-center gap-3">
            <MuteButton muted={view.muted} onToggle={onMute} t={t} />
            <EndCallButton onEnd={onEndCall} t={t} />
          </div>
        ) : null}
      </div>

      {review != null && onConfirmReview && onRetake ? <ReviewBox key={review} initial={review} t={t} busy={busy} onSend={onConfirmReview} onRetake={onRetake} /> : null}

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

/** Seconds before the words go to Tara on their own (cancelled as soon as the seller edits). */
export const REVIEW_AUTO_SEND_MS = 4000;

/**
 * What Tara heard, editable before it is sent: Enter (or Send) gives it to Tara, "Say it again"
 * re-opens the mic. If the seller doesn't touch it, it sends itself after REVIEW_AUTO_SEND_MS so a
 * hands-free conversation never stalls on an unnoticed box. Scrolled into view and focused.
 */
function ReviewBox({ initial, t, busy, onSend, onRetake }: { initial: string; t: VoiceUiCopy; busy: boolean; onSend: (text: string) => void; onRetake: () => void }) {
  const [text, setText] = useState(initial);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef(initial);
  const sentRef = useRef(false);
  const send = (value: string) => {
    if (sentRef.current || busy || !value.trim()) return;
    sentRef.current = true;
    onSend(value.trim());
  };
  useEffect(() => {
    const el = ref.current;
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => send(textRef.current), REVIEW_AUTO_SEND_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one countdown per box
  }, [auto]);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
      className="relative flex flex-col gap-2 overflow-hidden rounded-[var(--r-md)] border border-mk-accent bg-mk-elev-2 p-3 shadow-[0_0_0_4px_rgb(234_88_12/0.18)]"
    >
      {auto ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left bg-mk-accent motion-safe:animate-[tara-review_4s_linear_forwards]" /> : null}
      <style>{"@keyframes tara-review{from{transform:scaleX(1)}to{transform:scaleX(0)}}"}</style>
      <label htmlFor="tara-review" className="font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-accent">
        {t.reviewLabel}
      </label>
      <textarea
        id="tara-review"
        ref={ref}
        value={text}
        onChange={(e) => {
          setAuto(false); // they're fixing a word: wait for Enter / Send
          textRef.current = e.target.value;
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send(text);
          } else if (e.key !== "Tab") setAuto(false);
        }}
        rows={2}
        maxLength={1000}
        className={cn(onbField, "min-h-16 resize-none")}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !text.trim()} className={cn(onbButton.primary, "min-h-11 px-4")}>
          <Send className="size-4" aria-hidden />
          {t.reviewSend}
        </button>
        <button
          type="button"
          onClick={() => {
            sentRef.current = true;
            onRetake();
          }}
          className={cn(onbButton.secondary, "min-h-11 px-4")}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t.reviewRetake}
        </button>
      </div>
    </form>
  );
}
