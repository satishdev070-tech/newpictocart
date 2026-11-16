"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { canOpenStep, parseInfoLocale, STORE_DRAFT_KEY, resumeStep, withSeededServices, type InfoStep } from "../draft";
import { findServiceType, seedFor } from "../../service-types";
import { AccountStep } from "./account-step";
import { BasicInfoStep } from "./basic-info-step";
import { FinishStep } from "./finish-step";
import { ServicesStep } from "./services-step";
import { InformativeShell, type OnboardingLogo } from "./shell";
import { ThemeStep, type ThemeCard } from "./theme-step";
import { useInformativeDraft } from "./use-draft";
import { infoCopy } from "@/features/start/i18n/info-copy";

/** The language picked at /start/lang, saved in the store journey's draft (read-only here). */
function storeJourneyLocale(): ReturnType<typeof parseInfoLocale> {
  try {
    const raw = window.localStorage.getItem(STORE_DRAFT_KEY);
    const locale: unknown = raw ? (JSON.parse(raw) as { locale?: unknown })?.locale : null;
    return parseInfoLocale(locale);
  } catch {
    return null;
  }
}

/**
 * Informative onboarding (docs/informative/PLAN.md): basic info → theme (live preview) → starter
 * services (optional) → account → finish (one transaction) → /informative/dashboard. Every step has
 * its own URL (/start/informative/<step>); a step that needs earlier data sends the person back to
 * the first incomplete step. Back on the first step returns to the website-type choice.
 */
export function InformativeJourney({
  step,
  logo,
  rootDomain,
  themes,
  signedIn,
  googleAvailable,
  lang = null,
}: {
  step: InfoStep;
  logo: OnboardingLogo;
  rootDomain: string;
  themes: ThemeCard[];
  signedIn: boolean;
  googleAvailable: boolean;
  /** `?lang=` from /start/lang → /start/build (validated Sarvam code), if any. */
  lang?: string | null;
}) {
  const router = useRouter();
  const { draft, setDraft, hydrated } = useInformativeDraft();
  const go = (s: InfoStep) => router.push(`/start/informative/${s}`);

  // Language: ?lang= wins; otherwise the store journey's choice (same /start/lang screen). A direct
  // visit with neither keeps the draft's language (English by default).
  const draftLocale = draft.locale;
  useEffect(() => {
    if (!hydrated) return;
    const next = parseInfoLocale(lang) ?? (draftLocale === "en-IN" ? storeJourneyLocale() : null);
    if (next && next !== draftLocale) setDraft((d) => ({ ...d, locale: next }));
  }, [hydrated, lang, draftLocale, setDraft]);

  // Deep links can't skip ahead of the data they need.
  const firstIncomplete = resumeStep(draft);
  const blocked = hydrated && !canOpenStep(step, draft);
  useEffect(() => {
    if (blocked) router.replace(`/start/informative/${firstIncomplete}`);
  }, [blocked, firstIncomplete, router]);

  if (!hydrated || blocked) {
    return (
      <InformativeShell logo={logo} step={step === "finish" ? null : step} locale={draftLocale}>
        <p className="text-mk-muted" aria-live="polite">{infoCopy(draftLocale).loading}</p>
      </InformativeShell>
    );
  }

  const name = typeof draft.basic.businessName === "string" ? draft.basic.businessName : "";
  const category = typeof draft.basic.category === "string" ? draft.basic.category : null;

  switch (step) {
    case "basic-info":
      return (
        <InformativeShell logo={logo} step={step} locale={draftLocale}>
          <BasicInfoStep
            draft={draft}
            rootDomain={rootDomain}
            onBack={() => router.push("/start/build")}
            onSave={(basic, logoDataUrl) => {
              const type = findServiceType(basic.serviceTypeId);
              const seed = type ? seedFor(type, { name: basic.businessName, city: basic.city }).services : null;
              setDraft((d) => withSeededServices({ ...d, basic, logoDataUrl }, basic.serviceTypeId, seed));
              go("theme");
            }}
          />
        </InformativeShell>
      );
    case "theme":
      return (
        <InformativeShell logo={logo} step={step} wide locale={draftLocale}>
          <ThemeStep
            themes={themes}
            locale={draftLocale}
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
        <InformativeShell logo={logo} step={step} locale={draftLocale}>
          <ServicesStep
            draft={draft}
            onBack={() => go("theme")}
            onSkip={() => {
              setDraft((d) => ({ ...d, services: [], servicesSkipped: true, seededFrom: null }));
              go("account");
            }}
            onSave={(services) => {
              setDraft((d) => ({ ...d, services, servicesSkipped: false, seededFrom: JSON.stringify(services) === JSON.stringify(d.services) ? d.seededFrom : null }));
              go("account");
            }}
          />
        </InformativeShell>
      );
    case "account":
      return (
        <InformativeShell logo={logo} step={step} locale={draftLocale}>
          <AccountStep locale={draftLocale} signedIn={signedIn} googleAvailable={googleAvailable} businessName={name} onBack={() => go("services")} onFinish={() => go("finish")} />
        </InformativeShell>
      );
    case "finish":
      return (
        <InformativeShell logo={logo} step={null} locale={draftLocale}>
          <FinishStep draft={draft} onEdit={(s) => go(s)} />
        </InformativeShell>
      );
  }
}
