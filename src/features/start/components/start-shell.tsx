"use client";

import { Mic, MicOff } from "lucide-react";
import { OnbProgress, OnbTopBar, OnboardingTheme } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { SARVAM_LOCALES, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { progressFor } from "../flow";
import type { StartDraft, StartScreen } from "../draft/schema";
import { startCopy } from "../copy";
import { START_UI_LOCALES } from "../supported-locales";

export type StartLogo = { src: string; width: number | null; height: number | null; name: string };

const UI_LOCALES = SARVAM_LOCALES.filter((l) => (START_UI_LOCALES as readonly string[]).includes(l.code));

/** Dark onboarding frame for /start/*: logo, "Online store" progress, sign-in link, voice toggle, language menu. */
export function StartShell({
  draft,
  screen,
  logo,
  voiceEnabled,
  onVoiceToggle,
  onLocaleChange,
  voiceAvailable = true,
  buildStep = false,
  children,
  layout = "center",
}: {
  draft: StartDraft;
  screen: StartScreen;
  logo: StartLogo;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  /** Language menu: switch the UI language in place. */
  onLocaleChange: (code: SarvamLocaleCode) => void;
  /** When false, the voice toggle is shown as unavailable. */
  voiceAvailable?: boolean;
  /** Whether the Online Store | Informative step exists (changes step numbers). */
  buildStep?: boolean;
  children: React.ReactNode;
  layout?: "center" | "split";
}) {
  const c = startCopy(draft.locale);
  const progress = progressFor(screen, { buildStep });
  const showSignIn = screen !== "account" && screen !== "done" && screen !== "building";

  return (
    <OnboardingTheme>
      <OnbTopBar
        logo={
          // eslint-disable-next-line @next/next/no-img-element -- platform logo (uploaded or static)
          <img
            src={logo.src}
            width={logo.width ?? undefined}
            height={logo.height ?? undefined}
            alt={logo.name}
            className="h-8 w-auto max-w-[140px] object-contain object-left sm:h-9 sm:max-w-[180px]"
          />
        }
        progress={progress ? <OnbProgress step={progress.step} total={progress.total} label={c.progressLabel} /> : undefined}
        right={
          <>
            {showSignIn ? (
              // Hard nav so soft-nav cannot race StartJourney URL sync or leave a stale module draft.
              <a href="/login" className="inline-flex min-h-10 items-center px-1 text-mk-muted transition-colors hover:text-mk-text">
                <span className="hidden lg:inline">{c.account.haveAccount}&nbsp;</span>
                <span className="font-semibold text-mk-accent">{c.account.signIn}</span>
              </a>
            ) : null}
            {voiceAvailable ? (
              <button
                type="button"
                onClick={onVoiceToggle}
                aria-pressed={voiceEnabled}
                aria-label={voiceEnabled ? c.voiceOn : c.voiceOff}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 transition-colors",
                  voiceEnabled
                    ? "border-mk-accent/50 text-mk-text"
                    : "border-mk-line-strong text-mk-muted hover:text-mk-text",
                )}
              >
                {voiceEnabled ? <Mic aria-hidden className="size-4 text-mk-accent" /> : <MicOff aria-hidden className="size-4" />}
                <span className="hidden sm:inline">{voiceEnabled ? c.voiceOn : c.voiceOff}</span>
              </button>
            ) : null}
            <label className="relative inline-flex">
              <span className="sr-only">{c.language}</span>
              <select
                value={draft.locale}
                onChange={(e) => onLocaleChange(e.target.value as SarvamLocaleCode)}
                className="min-h-10 cursor-pointer appearance-none rounded-full border border-mk-line-strong bg-mk-elev-1 py-0 pl-3 pr-8 text-sm font-medium text-mk-text transition-colors hover:border-mk-text/40 focus-visible:outline-2 focus-visible:outline-mk-accent"
              >
                {UI_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeLabel}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-mk-muted">
                ▼
              </span>
            </label>
          </>
        }
      />
      <main
        id="main"
        className={cn(
          "mx-auto w-full px-4 pb-16 sm:px-6",
          progress ? "pt-12 sm:pt-4" : "pt-4",
          screen === "done" ? "max-w-7xl" : "max-w-6xl",
          layout === "split" && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-10",
        )}
      >
        {children}
      </main>
      <StartKeyframes />
    </OnboardingTheme>
  );
}

/** Keyframes used by TaraOrb and the voice screen (CSS only; `motion-safe:` at call sites). */
function StartKeyframes() {
  return (
    <style>{`
      @keyframes startSpin { to { transform: rotate(360deg); } }
      @keyframes startBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @keyframes startFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -12px; } }
    `}</style>
  );
}
