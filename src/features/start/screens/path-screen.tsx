"use client";

import { cn } from "@/lib/cn";
import { startCopy } from "../copy";
import { TaraOrb } from "../components/tara-orb";

export type PathChoice = { path: "ai"; mode: "talk" | "quiz" };

export function PathScreen({
  locale,
  path,
  mode,
  onSelect,
  onContinue,
}: {
  locale: string;
  path: "ai" | "manual" | null;
  mode: "talk" | "quiz";
  onSelect: (choice: PathChoice) => void;
  onContinue: () => void;
}) {
  const c = startCopy(locale);
  const voiceActive = path === "ai" && mode === "talk";
  const quizActive = path === "ai" && mode === "quiz";
  const canContinue = voiceActive || quizActive;

  return (
    <section className="flex w-full max-w-4xl flex-col gap-8">
      <div className="text-center">
        <h1 className="font-brand text-3xl font-normal leading-tight text-balance sm:text-5xl">
          {c.path.headline}
        </h1>
        <p className="mt-3 text-base text-[#5E5568] sm:text-lg">{c.path.sub}</p>
      </div>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2" role="listbox" aria-label={c.path.headline}>
        <PathCard
          active={voiceActive}
          onClick={() => onSelect({ path: "ai", mode: "talk" })}
          title={c.path.voiceTitle}
          desc={c.path.voiceDesc}
          visual={<TaraOrb size="sm" className="mx-auto" />}
          badge={c.path.voiceBadge}
        />
        <PathCard
          active={quizActive}
          onClick={() => onSelect({ path: "ai", mode: "quiz" })}
          title={c.path.quizTitle}
          desc={c.path.quizDesc}
          visual={
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#FFF7ED] text-2xl text-[#C2410C]" aria-hidden>
              ?
            </div>
          }
          badge={c.path.quizBadge}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-8 py-3.5 font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)] disabled:opacity-40"
        >
          {quizActive ? c.path.ctaQuiz : c.path.ctaVoice}
        </button>
      </div>
    </section>
  );
}

function PathCard({
  active,
  onClick,
  title,
  desc,
  visual,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  visual: React.ReactNode;
  badge: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex min-h-56 flex-col gap-5 rounded-[28px] border p-7 text-left transition sm:min-h-64 sm:p-8",
        active
          ? "border-[#F97316] bg-white shadow-[0_24px_50px_-24px_rgba(249,115,22,0.5)] ring-2 ring-[#F97316]/30"
          : "border-white/90 bg-white/55 hover:bg-white/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {visual}
        <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-xs font-semibold text-[#C2410C]">{badge}</span>
      </div>
      <div className="mt-auto space-y-2">
        <h2 className="flex items-center justify-between gap-2 text-2xl font-semibold tracking-tight">
          {title}
          {active ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#F97316] text-sm text-white" aria-hidden>
              ✓
            </span>
          ) : null}
        </h2>
        <p className="text-base leading-relaxed text-[#5E5568]">{desc}</p>
      </div>
    </button>
  );
}
