"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { SARVAM_LOCALES } from "@/lib/sarvam/locales";
import { progressFor } from "../flow";
import type { StartDraft, StartScreen } from "../draft/schema";
import { startCopy } from "../copy";

export type StartLogo = { src: string; width: number | null; height: number | null; name: string };

export function StartShell({
  draft,
  screen,
  logo,
  voiceEnabled,
  onVoiceToggle,
  onLangClick,
  voiceAvailable = true,
  children,
  layout = "center",
}: {
  draft: StartDraft;
  screen: StartScreen;
  logo: StartLogo;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  /** Unused — Back lives on individual screens. Kept optional for callers. */
  onBack?: () => void;
  onLangClick: () => void;
  /** When false, voice toggle is muted / labeled unavailable. */
  voiceAvailable?: boolean;
  children: React.ReactNode;
  layout?: "center" | "split";
}) {
  const c = startCopy(draft.locale);
  const progress = progressFor(screen, draft.path, draft.locale);
  const localeName = SARVAM_LOCALES.find((l) => l.code === draft.locale)?.englishName ?? "English";
  const hi = draft.locale === "hi-IN";

  const progressDisplay =
    progress.overall != null
      ? {
          percent: progress.percent,
          label: `${progress.overall} · ${progress.percent}%`,
          complete: false,
        }
      : screen === "done"
        ? {
            percent: 100,
            label: hi ? "100% पूर्ण" : "100% Complete",
            complete: true,
          }
        : null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#FBF6F1] text-[#2A2233]">
      <BackgroundBlobs />
      <header className="relative z-10 grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4 sm:px-8">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.src}
              width={logo.width ?? undefined}
              height={logo.height ?? undefined}
              alt={logo.name}
              className="h-10 max-w-[220px] w-auto object-contain object-left sm:h-12"
            />
          </Link>
        </div>

        {progressDisplay ? (
          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:mx-auto sm:max-w-sm">
            <div className="h-1 overflow-hidden rounded-full bg-[#2A2233]/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-[#FB923C] to-[#F97316] transition-[width] duration-500"
                style={{ width: `${progressDisplay.percent}%` }}
              />
            </div>
            <p className="flex items-center gap-1.5 font-mono text-[11px] leading-none text-[#6B6275] sm:justify-center">
              {progressDisplay.complete ? (
                <span
                  className="grid size-3.5 shrink-0 place-items-center rounded-full bg-[#22C55E] text-[8px] font-bold text-white"
                  aria-hidden
                >
                  ✓
                </span>
              ) : null}
              <span>{progressDisplay.label}</span>
            </p>
          </div>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
          {voiceAvailable ? (
            <button
              type="button"
              onClick={onVoiceToggle}
              aria-pressed={voiceEnabled}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 transition",
                voiceEnabled
                  ? "border-[#F97316]/35 bg-white/80 text-[#2A2233]"
                  : "border-white/90 bg-white/50 text-[#5E5568]",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", voiceEnabled ? "bg-[#22C55E]" : "bg-[#94A3B8]")}
                aria-hidden
              />
              {voiceEnabled ? c.voiceOn : c.voiceOff}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#2A2233]/15 bg-white/40 px-3 py-2 text-[#94A3B8]">
              <span className="size-1.5 rounded-full bg-[#CBD5E1]" aria-hidden />
              {hi ? "आवाज़ अनुपलब्ध" : "Voice unavailable"}
            </span>
          )}
          <button
            type="button"
            onClick={onLangClick}
            className="rounded-full border border-white/90 bg-white/70 px-3 py-2 font-medium text-[#2A2233] shadow-sm"
          >
            {localeName} ▾
          </button>
        </div>
      </header>
      <main
        className={cn(
          "relative z-10 mx-auto w-full px-4 pb-16 pt-2 sm:px-8",
          screen === "done" ? "max-w-7xl" : "max-w-6xl",
          layout === "split" && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-10",
        )}
      >
        {children}
      </main>
      <StartKeyframes />
    </div>
  );
}

export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-48 size-[680px] rounded-full bg-[#FFCFA8] opacity-85 blur-[90px] motion-safe:animate-[startDrift_18s_ease-in-out_infinite]" />
      <div className="absolute -right-40 top-28 size-[620px] rounded-full bg-[#FFD7B0] opacity-85 blur-[90px] motion-safe:animate-[startDrift_22s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-[-320px] left-[20%] h-[520px] w-[700px] rounded-full bg-[#FFE8D2] opacity-90 blur-[100px]" />
    </div>
  );
}

function StartKeyframes() {
  return (
    <style>{`
      @keyframes startDrift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px,60px) scale(1.12); } }
      @keyframes startSpin { to { transform: rotate(360deg); } }
      @keyframes startBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @keyframes startFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -12px; } }
    `}</style>
  );
}
