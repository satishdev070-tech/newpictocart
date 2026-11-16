import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { OnbCard, OnbProgress, OnbTopBar, OnboardingTheme, onbButton } from "@/components/onboarding-ui";
import { PLATFORM_LOGO, PLATFORM_NAME } from "@/config/platform";
import { ONBOARDING_STEPS, progressStep, stepIndex, type OnboardingStepKey, type WizardStep } from "../steps";
import { StepHeading } from "./step-heading";

export { StepHeading };

/** Static platform logo (OnbTopBar already wraps it in a home link). */
function BrandLogoMark() {
  return PLATFORM_LOGO ? (
    // eslint-disable-next-line @next/next/no-img-element -- static platform logo
    <img src={PLATFORM_LOGO.src} width={PLATFORM_LOGO.width ?? undefined} height={PLATFORM_LOGO.height ?? undefined} alt={PLATFORM_NAME} className="h-8 w-auto max-w-[160px] object-contain object-left sm:h-9" />
  ) : (
    <span className="font-brand text-xl font-extrabold tracking-tight text-mk-text">{PLATFORM_NAME}</span>
  );
}

/** Dark onboarding frame (shared kit): logo, step progress and a centred card. */
export function OnboardingShell({
  step,
  children,
  wide,
}: {
  step: WizardStep | OnboardingStepKey;
  children: ReactNode;
  wide?: boolean;
}) {
  const rail: OnboardingStepKey =
    step === "account" || step === "language" || step === "setup" || step === "building" || step === "ready"
      ? step
      : progressStep(step as WizardStep);
  const current = stepIndex(rail);
  return (
    <OnboardingTheme className="flex flex-col">
      <OnbTopBar
        logo={<BrandLogoMark />}
        progress={<OnbProgress step={current + 1} total={ONBOARDING_STEPS.length} label="Setup" />}
        right={
          <Link href="/dashboard" className={onbButton.ghost}>
            Save and exit
          </Link>
        }
      />
      <nav aria-label="Setup progress" className="mx-auto w-full max-w-5xl px-4 pt-10 sm:px-6 sm:pt-0">
        <ol className="flex items-center gap-2 overflow-x-auto py-3 sm:gap-4">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.key} className="flex shrink-0 items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold",
                    done && "bg-mk-accent text-mk-accent-ink",
                    active && "bg-mk-accent-tint text-mk-accent ring-2 ring-mk-accent",
                    !done && !active && "bg-mk-elev-2 text-mk-dim ring-1 ring-mk-line-strong",
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("text-sm font-semibold", active ? "text-mk-text" : "text-mk-muted")}>
                  {s.label}
                  <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
                </span>
                {i < ONBOARDING_STEPS.length - 1 ? <span aria-hidden className={cn("h-px w-6 sm:w-10", done ? "bg-mk-accent" : "bg-mk-line-strong")} /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <main id="main" className="flex-1 px-4 pb-16 pt-6 sm:px-6">
        <OnbCard className={cn("mx-auto", wide ? "max-w-5xl" : "max-w-xl")}>{children}</OnbCard>
      </main>
    </OnboardingTheme>
  );
}
