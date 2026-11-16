import type { ReactNode } from "react";
import { OnbProgress, OnbTopBar, OnboardingTheme, onbButton, onbError, onbField, onbHint, onbLabel } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";

export type OnboardingLogo = { src: string; width: number | null; height: number | null; name: string };

/**
 * Class names for the informative journey, mapped onto the shared dark onboarding kit
 * (src/components/onboarding-ui): near-black surfaces, off-white text, one orange accent.
 */
export const ui = {
  primaryBtn: onbButton.primary,
  secondaryBtn: onbButton.secondary,
  ghostBtn: onbButton.ghost,
  link: onbButton.link,
  /** Field inside a wrapping <label>: the label text sits above it. */
  input: cn(onbField, "mt-1.5 disabled:cursor-not-allowed disabled:opacity-55"),
  label: cn(onbLabel, "mb-0"),
  error: onbError,
  hint: onbHint,
  muted: "text-mk-muted",
  card: "rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-5 shadow-[var(--brand-shadow-card)] sm:p-8",
  /** "Same as phone"-style checkbox. */
  checkbox: "size-5 shrink-0 cursor-pointer rounded accent-mk-accent",
  /** Native file input rendered as a secondary pill. */
  file: "block w-full min-w-0 max-w-full text-sm text-mk-muted file:mr-3 file:inline-flex file:min-h-11 file:cursor-pointer file:items-center file:rounded-full file:border file:border-solid file:border-mk-line-strong file:bg-transparent file:px-5 file:text-sm file:font-semibold file:text-mk-text file:transition-colors hover:file:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
};

const STEP_NUMBER: Record<string, number> = { "basic-info": 1, theme: 2, services: 3, account: 4 };
export const INFO_STEP_TOTAL = 4;

export function InformativeShell({ logo, step, children, wide = false }: { logo: OnboardingLogo; step: string | null; children: ReactNode; wide?: boolean }) {
  const n = step ? STEP_NUMBER[step] : undefined;
  return (
    <OnboardingTheme>
      <OnbTopBar
        logo={
          logo.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- platform logo, same as /start
            <img src={logo.src} alt={logo.name} width={logo.width ?? 120} height={logo.height ?? 32} className="h-8 w-auto max-w-[140px] object-contain object-left sm:h-9 sm:max-w-[180px]" />
          ) : (
            <span className="font-brand text-xl font-extrabold tracking-tight text-mk-text">{logo.name}</span>
          )
        }
        progress={n ? <OnbProgress step={n} total={INFO_STEP_TOTAL} label="Website" /> : undefined}
      />
      <main id="main" className={cn("mx-auto w-full min-w-0 px-4 pb-16 sm:px-6", n ? "pt-12 sm:pt-6" : "pt-6", wide ? "max-w-6xl" : "max-w-2xl")}>
        {children}
      </main>
    </OnboardingTheme>
  );
}
