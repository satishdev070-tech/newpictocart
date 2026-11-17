"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Sparkles, User } from "lucide-react";
import { onbButton } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { messageCount, type TranscriptEntry } from "@/features/onboarding/voice/transcript";
import type { VoiceUiCopy } from "./voice-copy";

function clock(at: number | null): string | null {
  if (at === null) return null;
  try {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function Avatar({ role }: { role: "tara" | "seller" }) {
  return role === "tara" ? (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#ea580c_100%)]">
      <Sparkles className="size-3.5 text-mk-accent-ink" aria-hidden />
    </span>
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-mk-line-strong bg-mk-elev-2 text-mk-muted">
      <User className="size-4" aria-hidden />
    </span>
  );
}

function Bubble({ entry, t }: { entry: TranscriptEntry; t: VoiceUiCopy }) {
  if (entry.role === "system") {
    return (
      <p className="mx-auto max-w-[90%] rounded-full border border-mk-line px-3 py-1 text-center text-xs text-mk-dim" role="status">
        {entry.text}
      </p>
    );
  }
  const tara = entry.role === "tara";
  const time = clock(entry.at);
  return (
    <div className={cn("flex items-end gap-2", tara ? "justify-start" : "flex-row-reverse")}>
      <Avatar role={entry.role} />
      <div className={cn("flex max-w-[82%] flex-col gap-1", tara ? "items-start" : "items-end")}>
        <p className="font-mk-mono text-[10px] uppercase tracking-[0.12em] text-mk-dim">
          {tara ? t.agentName : t.you}
          {time ? <span className="ml-1.5 normal-case tracking-normal">{time}</span> : null}
        </p>
        <p
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
            tara ? "rounded-bl-md border border-mk-line bg-mk-elev-2 text-mk-text" : "rounded-br-md bg-mk-accent text-mk-accent-ink",
          )}
        >
          {entry.text}
        </p>
      </div>
    </div>
  );
}

/** The seller's words while they are still speaking (browser recognition), dimmer than sent lines. */
function LiveCaption({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex flex-row-reverse items-end gap-2" aria-live="off">
      <Avatar role="seller" />
      <div className="flex max-w-[82%] flex-col items-end gap-1">
        <p className="inline-flex items-center gap-1.5 font-mk-mono text-[10px] uppercase tracking-[0.12em] text-mk-dim">
          <span aria-hidden className="size-1.5 rounded-full bg-mk-accent motion-safe:animate-pulse" />
          {label}
        </p>
        <p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-dashed border-mk-accent/50 bg-mk-accent/15 px-3.5 py-2.5 text-[15px] italic leading-relaxed text-mk-text/80">
          {text}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2" role="status" aria-label={label}>
      <Avatar role="tara" />
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-mk-line bg-mk-elev-2 px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="size-1.5 rounded-full bg-mk-muted motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TranscriptPanel({
  t,
  entries,
  liveCaption = "",
  liveLabel,
  thinking,
  onClear,
  footer,
}: {
  t: VoiceUiCopy;
  entries: TranscriptEntry[];
  /** What the seller is saying right now (empty = nothing to show). */
  liveCaption?: string;
  /** Label above the live caption (e.g. "Hearing…"). */
  liveLabel?: string;
  thinking: boolean;
  onClear: () => void;
  /** Confirmation card, rendered after the last message. */
  footer?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const n = messageCount(entries);
  const hasFooter = Boolean(footer);

  // Keep the newest line (or the typing indicator / confirm card) in view without moving the page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [entries.length, thinking, hasFooter, liveCaption]);

  return (
    <div className="flex min-h-[420px] flex-col rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 shadow-[var(--brand-shadow-card)] lg:h-[min(72dvh,680px)]">
      <div className="flex items-center justify-between gap-3 border-b border-mk-line px-5 py-3.5">
        <p className="text-sm font-semibold text-mk-text">
          {t.transcriptTitle} <span className="font-normal text-mk-dim">· {t.messages(n)}</span>
        </p>
        <button type="button" onClick={onClear} disabled={n === 0 || thinking} className={cn(onbButton.ghost, "min-h-8 px-2 text-xs disabled:opacity-40")}>
          {t.clear}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex max-h-[60dvh] flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5 lg:max-h-none"
        aria-live="polite"
        aria-relevant="additions"
      >
        {entries.length === 0 ? <p className="m-auto text-sm text-mk-dim">{t.emptyTranscript}</p> : null}
        {entries.map((e) => (
          <Bubble key={e.id} entry={e} t={t} />
        ))}
        {liveCaption ? <LiveCaption text={liveCaption} label={liveLabel ?? t.you} /> : null}
        {thinking ? <TypingIndicator label={t.stateThinking} /> : null}
        {footer}
      </div>
    </div>
  );
}
