"use client";

import { Check, ListChecks } from "lucide-react";
import { OnbHeading, OnbSub, onbButton, onbChoice } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { startCopy } from "../copy";
import { TaraOrb } from "../components/tara-orb";

export type PathChoice = { path: "ai"; mode: "talk" | "quiz" };

/** Online store: Tara voice (when Sarvam is configured) or the quick quiz. */
export function PathScreen({
  locale,
  path,
  mode,
  voiceReady,
  onSelect,
  onBack,
  onContinue,
}: {
  locale: string;
  path: "ai" | "manual" | null;
  mode: "talk" | "quiz";
  /** Sarvam configured on the server. False → voice card disabled, quiz only. */
  voiceReady: boolean;
  onSelect: (choice: PathChoice) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const c = startCopy(locale);
  const effectiveMode = !voiceReady && mode === "talk" ? "quiz" : mode;
  const voiceActive = voiceReady && path === "ai" && effectiveMode === "talk";
  const quizActive = path === "ai" && effectiveMode === "quiz";
  const canContinue = voiceActive || quizActive;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 pt-6 sm:pt-10">
      <div className="space-y-3 text-center">
        <OnbHeading>{c.path.headline}</OnbHeading>
        <OnbSub>{c.path.sub}</OnbSub>
      </div>
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2" role="listbox" aria-label={c.path.headline}>
        <PathCard
          active={voiceActive}
          disabled={!voiceReady}
          onClick={() => onSelect({ path: "ai", mode: "talk" })}
          title={c.path.voiceTitle}
          desc={voiceReady ? c.path.voiceDesc : c.path.voiceUnavailable}
          visual={<TaraOrb size="sm" />}
          badge={voiceReady ? c.path.voiceBadge : null}
        />
        <PathCard
          active={quizActive}
          onClick={() => onSelect({ path: "ai", mode: "quiz" })}
          title={c.path.quizTitle}
          desc={c.path.quizDesc}
          visual={
            <div className="grid size-16 place-items-center rounded-[var(--r-md)] bg-mk-accent-tint text-mk-accent" aria-hidden>
              <ListChecks className="size-8" strokeWidth={2} />
            </div>
          }
          badge={c.path.quizBadge}
        />
      </div>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={onbButton.secondary}>
          ← {c.back}
        </button>
        <button type="button" disabled={!canContinue} onClick={onContinue} className={onbButton.primary}>
          {quizActive ? c.path.ctaQuiz : c.path.ctaVoice}
        </button>
      </div>
    </section>
  );
}

function PathCard({
  active,
  disabled,
  onClick,
  title,
  desc,
  visual,
  badge,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  visual: React.ReactNode;
  badge: string | null;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
      className={onbChoice(
        active,
        cn("flex min-h-52 flex-col gap-5 p-6 sm:min-h-60 sm:p-7", disabled && "cursor-not-allowed opacity-55 hover:border-mk-line hover:bg-mk-elev-1"),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {visual}
        {badge ? (
          <span className="rounded-full border border-mk-line-strong px-2.5 py-1 font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-auto space-y-2">
        <h2 className="flex items-center justify-between gap-2 font-brand text-xl font-semibold tracking-tight text-mk-text sm:text-2xl">
          {title}
          {active ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mk-accent text-mk-accent-ink" aria-hidden>
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : null}
        </h2>
        <p className="text-[15px] leading-relaxed text-mk-muted">{desc}</p>
      </div>
    </button>
  );
}
