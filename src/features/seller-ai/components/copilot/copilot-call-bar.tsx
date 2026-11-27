"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, RotateCcw, Send, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import { callUiState } from "@/features/onboarding/voice/call-machine";
import type { TaraCallView, useTaraCall } from "@/features/onboarding/voice/use-tara-call";
import type { CopilotCopy } from "@/features/seller-ai/copilot/copy";

type Call = ReturnType<typeof useTaraCall>;
export type CopilotCallBarProps = {
  view: TaraCallView;
  caption: string;
  review: string | null;
  meterRef: Call["meterRef"];
  onTap: () => void;
  onMute: () => void;
  onEnd: () => void;
  onConfirmReview: (text: string) => void;
  onRetake: () => void;
  copy: CopilotCopy;
  busy: boolean;
};

/** Same pause as voice onboarding before heard words are sent on their own. */
const REVIEW_AUTO_SEND_MS = 4_000;

/**
 * The live voice call strip in the Tara drawer: what Tara is doing, the words being heard, a
 * Done / interrupt orb, mute and end. The call engine is voice onboarding's `useTaraCall`.
 */
export function CopilotCallBar({ view, caption, review, meterRef, onTap, onMute, onEnd, onConfirmReview, onRetake, copy, busy }: CopilotCallBarProps) {
  const ui = callUiState(view);
  const status =
    view.phase === "connecting"
      ? copy.callConnecting
      : view.muted
        ? copy.callMuted
        : ui === "listening"
          ? copy.callListening
          : ui === "thinking"
            ? copy.callThinking
            : ui === "speaking"
              ? copy.callSpeaking
              : "";
  const notice = view.suggestTyping ? copy.callTypeInstead : view.notHeard ? copy.callNotHeard : null;

  return (
    <div className="border-t border-accent/30 bg-accent-soft/40 px-3 py-2.5" role="region" aria-label={copy.callStart}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          ref={meterRef}
          onClick={onTap}
          disabled={ui === "thinking" || view.phase === "reviewing"}
          aria-label={ui === "speaking" ? copy.callInterrupt : copy.callDone}
          title={ui === "speaking" ? copy.callInterrupt : copy.callDone}
          style={{ boxShadow: ui === "listening" ? "0 0 0 calc(var(--lvl, 0) * 10px) rgb(234 88 12 / 0.25)" : undefined }}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-white transition-shadow disabled:opacity-70",
            ui === "speaking" ? "bg-accent motion-safe:animate-pulse" : ui === "listening" ? "bg-error" : "bg-accent",
          )}
        >
          {ui === "thinking" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : ui === "speaking" ? <Square aria-hidden className="size-4" /> : <Mic aria-hidden className="size-5" />}
        </button>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-caption font-semibold text-foreground">{status}</p>
          {caption ? <p className="line-clamp-2 text-caption italic text-muted">“{caption}”</p> : null}
          {notice ? <p className="text-[11px] text-muted">{notice}</p> : null}
        </div>
        {ui === "listening" ? (
          <button type="button" onClick={onTap} className="min-h-9 rounded-lg bg-accent px-3 text-caption font-semibold text-white">
            {copy.callDone}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onMute}
          aria-pressed={view.muted}
          aria-label={view.muted ? copy.callUnmute : copy.callMute}
          title={view.muted ? copy.callUnmute : copy.callMute}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface hover:bg-surface-secondary"
        >
          {view.muted ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label={copy.callEnd}
          title={copy.callEnd}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-error text-white hover:opacity-90"
        >
          <PhoneOff aria-hidden className="size-4" />
        </button>
      </div>
      {review != null ? <ReviewBox key={review} initial={review} copy={copy} busy={busy} onSend={onConfirmReview} onRetake={onRetake} /> : null}
    </div>
  );
}

/** What was heard: sends itself after a short pause unless the seller starts editing. */
function ReviewBox({ initial, copy, busy, onSend, onRetake }: { initial: string; copy: CopilotCopy; busy: boolean; onSend: (text: string) => void; onRetake: () => void }) {
  const [text, setText] = useState(initial);
  const [auto, setAuto] = useState(true);
  const textRef = useRef(initial);
  const sentRef = useRef(false);
  const send = (value: string) => {
    if (sentRef.current || busy || !value.trim()) return;
    sentRef.current = true;
    onSend(value.trim());
  };
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => send(textRef.current), REVIEW_AUTO_SEND_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one countdown per box
  }, [auto]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
      className="relative mt-2 space-y-2 overflow-hidden rounded-lg border border-accent bg-surface p-2.5"
    >
      {auto ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left bg-accent motion-safe:animate-[copilot-review_4s_linear_forwards]" /> : null}
      <style>{"@keyframes copilot-review{from{transform:scaleX(1)}to{transform:scaleX(0)}}"}</style>
      <label className="block text-[11px] font-medium text-accent">
        {copy.callReviewLabel}
        <textarea
          value={text}
          autoFocus
          onChange={(e) => {
            setAuto(false);
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
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-small text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !text.trim()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-caption font-semibold text-white disabled:opacity-60">
          <Send aria-hidden className="size-3.5" /> {copy.callReviewSend}
        </button>
        <button
          type="button"
          onClick={() => {
            sentRef.current = true;
            onRetake();
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-caption"
        >
          <RotateCcw aria-hidden className="size-3.5" /> {copy.callReviewRetake}
        </button>
      </div>
    </form>
  );
}
