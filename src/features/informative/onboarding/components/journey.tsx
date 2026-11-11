"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resumeStep, type InfoStep } from "../draft";
import { AccountStep } from "./account-step";
import { BasicInfoStep } from "./basic-info-step";
import { FinishStep } from "./finish-step";
import { ServicesStep } from "./services-step";
import { InformativeShell, type OnboardingLogo } from "./shell";
import { ThemeStep, type ThemeCard } from "./theme-step";
import { useInformativeDraft } from "./use-draft";

const ORDER: InfoStep[] = ["basic-info", "theme", "services", "account", "finish"];

/**
 * Informative onboarding (docs/informative/PLAN.md): basic info → theme (live preview) → starter
 * services (optional) → account → finish (one transaction) → /informative/dashboard. Every step has
 * its own URL (/start/informative/<step>); a step that needs earlier data sends the person back to
 * the first incomplete step. Back on the first step returns to the website-type choice.
 */
export function InformativeJourney({ step, logo, rootDomain, themes, signedIn, googleAvailable }: { step: InfoStep; logo: OnboardingLogo; rootDomain: string; themes: ThemeCard[]; signedIn: boolean; googleAvailable: boolean }) {
  const router = useRouter();
  const { draft, setDraft, hydrated } = useInformativeDraft();
  const go = (s: InfoStep) => router.push(`/start/informative/${s}`);

  // Deep links can't skip ahead of the data they need.
  const firstIncomplete = resumeStep(draft);
  const blocked = hydrated && ORDER.indexOf(step) > ORDER.indexOf(firstIncomplete);
  useEffect(() => {
    if (blocked) router.replace(`/start/informative/${firstIncomplete}`);
  }, [blocked, firstIncomplete, router]);

  if (!hydrated || blocked) {
    return (
      <InformativeShell logo={logo} step={step === "finish" ? null : step}>
        <p className="text-[#5E5568]" aria-live="polite">Loading…</p>
      </InformativeShell>
    );
  }

  const name = typeof draft.basic.businessName === "string" ? draft.basic.businessName : "";
  const category = typeof draft.basic.category === "string" ? draft.basic.category : null;

  switch (step) {
    case "basic-info":
      return (
        <InformativeShell logo={logo} step={step}>
          <BasicInfoStep
            draft={draft}
            rootDomain={rootDomain}
            onBack={() => router.push("/start/build")}
            onSave={(basic, logoDataUrl) => {
              setDraft((d) => ({ ...d, basic, logoDataUrl }));
              go("theme");
            }}
          />
        </InformativeShell>
      );
    case "theme":
      return (
        <InformativeShell logo={logo} step={step} wide>
          <ThemeStep
            themes={themes}
            category={category}
            businessName={name}
            logoDataUrl={draft.logoDataUrl}
            selected={draft.themeId}
            onSelect={(id) => setDraft((d) => ({ ...d, themeId: id }))}
            onBack={() => go("basic-info")}
            onContinue={() => go("services")}
          />
        </InformativeShell>
      );
    case "services":
      return (
        <InformativeShell logo={logo} step={step}>
          <ServicesStep
            draft={draft}
            onBack={() => go("theme")}
            onSkip={() => {
              setDraft((d) => ({ ...d, services: [], servicesSkipped: true }));
              go("account");
            }}
            onSave={(services) => {
              setDraft((d) => ({ ...d, services, servicesSkipped: false }));
              go("account");
            }}
          />
        </InformativeShell>
      );
    case "account":
      return (
        <InformativeShell logo={logo} step={step}>
          <AccountStep signedIn={signedIn} googleAvailable={googleAvailable} businessName={name} onBack={() => go("services")} onFinish={() => go("finish")} />
        </InformativeShell>
      );
    case "finish":
      return (
        <InformativeShell logo={logo} step={null}>
          <FinishStep draft={draft} onEdit={(s) => go(s)} />
        </InformativeShell>
      );
  }
}
