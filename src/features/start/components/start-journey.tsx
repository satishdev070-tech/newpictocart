"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { finalizeOnce, isFinalizeInFlight } from "../finalize-once";
import { clearFinalizeProgress, readFinalizeProgress, runStartFinalize, subscribeFinalizeProgress } from "../finalize-run";
import { initialFinalizeProgress } from "../finalize-phases";
import { phaseProgressPct, phaseStepIndex } from "../building-progress";
import { startCopy } from "../copy";
import { useStartDraft } from "../draft/use-start-draft";
import { clearStartDraftCookie, clearStartDraftStorage, setStartDraftCookie } from "../draft/storage";
import type { StartDraft, StartScreen } from "../draft/schema";
import { draftReadyToFinalize, draftHasProgress, backTarget, nextScreenAfterLang, nextScreenAfterPath } from "../flow";
import { draftStoreName } from "../draft/schema";
import { suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { StartShell, type StartLogo } from "./start-shell";
import { onbButton } from "@/components/onboarding-ui";
import { LangScreen } from "../screens/lang-screen";
import { PathScreen } from "../screens/path-screen";
import { VoiceScreen } from "../screens/voice-screen";
import { QuizScreen } from "../screens/quiz-screen";
import { ThemeScreen } from "../screens/theme-screen";
import { BuildingScreen } from "../screens/building-screen";
import { AccountScreen } from "../screens/account-screen";
import { DoneScreen } from "../screens/done-screen";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { VoiceFacts } from "@/features/onboarding/voice/facts";
import type { StartVoiceTurn } from "../draft/schema";
import { emptyStartDraft } from "../draft/schema";
import { mergeFacts } from "@/features/onboarding/voice/facts";
import { isStartStepId, startStepPath, type StartStepId } from "../steps";
import { applyStoreFacts, storeFactsFromDraft, type StoreFacts } from "../draft/apply-facts";
import { TypeSelector, informativeEntryHref } from "@/features/informative/onboarding/components/type-selector";

const SERVER_FINALIZE_PROGRESS = initialFinalizeProgress();
const serverFinalizeProgress = () => SERVER_FINALIZE_PROGRESS;

/** Legacy screens remapped into the current graph (do not mount the old UIs). The old manual
 * "business" form is now the quiz (same fields, multi-select). */
const LEGACY_SCREEN_REMAP: Partial<Record<StartScreen, StartScreen>> = {
  welcome: "lang",
  intent: "path",
  business: "quiz",
  products: "quiz",
  mood: "theme",
  payment: "theme",
};

function urlStepFor(screen: StartScreen, buildStep = true): StartStepId {
  const remapped = LEGACY_SCREEN_REMAP[screen] ?? screen;
  // No build step (informative gate off) → that screen is the path chooser.
  if (remapped === "build" && !buildStep) return "path";
  return isStartStepId(remapped) ? remapped : "lang";
}

export function StartJourney({
  plan,
  theme,
  signedIn,
  landingPath,
  logo,
  rootDomain,
  googleAvailable,
  voiceReady,
  initialStep,
  buildStep = false,
}: {
  plan?: string | null;
  theme?: string | null;
  signedIn: boolean;
  landingPath: string | null;
  logo: StartLogo;
  rootDomain: string;
  googleAvailable: boolean;
  voiceReady: boolean;
  /** From `/start/[step]` — empty drafts adopt this; drafts with progress resume and replace the URL. */
  initialStep?: StartScreen;
  /** /start/build (Online Store | Informative Website) exists — informative onboarding gate allows it. */
  buildStep?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { draft, setDraft, patchDraft, hydrated } = useStartDraft({ plan, theme });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  /** Set when a finalize phase still failed after its retries; "Try again" resumes that phase. */
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const finalizeProgress = useSyncExternalStore(subscribeFinalizeProgress, readFinalizeProgress, serverFinalizeProgress);
  const finalizing = useRef(false);
  const routedEmpty = useRef(false);
  const leavingDone = useRef(false);
  const bootstrapped = useRef(false);
  /** Target path for the in-flight programmatic `router.replace` (ignore until it lands). */
  const pendingPath = useRef<string | null>(null);
  /** Browser Back/Forward — only then adopt `/start/[step]` into the draft. */
  const popped = useRef(false);

  const replaceStepUrl = useCallback(
    (screen: StartScreen) => {
      const path = startStepPath(urlStepFor(screen, buildStep));
      if (pathname !== path) {
        pendingPath.current = path;
        router.replace(path);
      }
    },
    [pathname, router, buildStep],
  );

  useEffect(() => {
    const onPopState = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const finalize = useCallback(() => {
    if (!draft || finalizing.current || draft.result) return;
    finalizing.current = true;
    setFinalizeError(null);
    const draftJson = JSON.stringify(draft);
    // Single-flight across remounts (OTP → /start → /start/lang → /start/account): a remounted
    // journey joins the in-flight run instead of starting a second seed on the same tenant.
    // Phases (store → catalogue → content → photos → theme → finish) each retry 3× with backoff and
    // save their resume point, so a Worker killed mid-phase (Error 1102) never restarts from scratch.
    void finalizeOnce(() => runStartFinalize(draftJson))
      .catch(() => null)
      .then((res) => {
        if (res?.ok) {
          clearFinalizeProgress();
          setDraft((d) => ({ ...d, result: { slug: res.slug, name: res.name }, screen: "done" }));
          // Mid-journey gates should stop treating this as in-progress; keep LS for Done UI.
          clearStartDraftCookie();
          return;
        }
        finalizing.current = false;
        const fallback = startCopy(draft.locale).building.failedBody;
        setFinalizeError(res?.message || fallback);
      });
  }, [draft, setDraft]);

  const go = useCallback(
    (screen: StartScreen) => {
      if (!draft) return;
      const next = { ...draft, screen };
      if (screen !== "welcome" && screen !== "done") setStartDraftCookie();
      setDraft(next);
      replaceStepUrl(screen);
    },
    [draft, setDraft, replaceStepUrl],
  );

  // Bootstrap once (resume wins vs URL), then keep `/start/[step]` aligned with draft.screen.
  // Prefer draft → URL. Adopting URL → draft only on browser Back/Forward (popstate).
  // Adopting on every mismatch fought Quiz/Voice setDraft(screen: theme) and pinned users on /quiz.
  useEffect(() => {
    if (!hydrated || !draft) return;

    // Soft-nav away (e.g. marketing Login) — do not fight with replace(/start/…).
    if (!pathname.startsWith("/start")) return;

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const remap = LEGACY_SCREEN_REMAP[draft.screen];
      const canonical = remap ?? draft.screen;
      const draftStep = urlStepFor(canonical, buildStep);

      if (draftHasProgress(draft)) {
        if (draft.screen !== draftStep) patchDraft({ screen: draftStep });
        replaceStepUrl(draftStep);
        return;
      }

      // Empty draft: URL step wins for deep links; bare `/start` already redirected to lang.
      if (initialStep && draft.screen !== initialStep) {
        patchDraft({ screen: initialStep });
        return;
      }

      if (remap) {
        patchDraft({ screen: remap });
        return;
      }

      replaceStepUrl(draft.screen);
      return;
    }

    if (pendingPath.current) {
      if (pathname === pendingPath.current) {
        pendingPath.current = null;
      }
      // Programmatic nav in flight: never adopt a stale URL into the draft.
      const desired = startStepPath(urlStepFor(draft.screen, buildStep));
      if (pathname !== desired && pendingPath.current !== desired) {
        pendingPath.current = desired;
        router.replace(desired);
      }
      return;
    }

    if (popped.current) {
      popped.current = false;
      const seg = pathname.split("/")[2]?.split("?")[0] ?? "";
      if (isStartStepId(seg)) {
        const pathStep = urlStepFor(seg, buildStep);
        if (pathStep !== urlStepFor(draft.screen, buildStep)) {
          patchDraft({ screen: pathStep });
        }
      }
      return;
    }

    replaceStepUrl(draft.screen);
  }, [hydrated, draft, initialStep, pathname, patchDraft, replaceStepUrl, router, buildStep]);


  // Voice needs Sarvam: without it, keep the path chooser on the quiz.
  useEffect(() => {
    if (!hydrated || !draft || voiceReady) return;
    if (draft.screen !== "path" || (draft.voice.mode ?? "talk") !== "talk") return;
    setDraft((d) => (d.screen === "path" && (d.voice.mode ?? "talk") === "talk" ? { ...d, voice: { ...d.voice, mode: "quiz" } } : d));
  }, [hydrated, draft, setDraft, voiceReady]);

  useEffect(() => {
    if (!hydrated || !draft || routedEmpty.current || leavingDone.current) return;
    if (signedIn && draft.result) {
      if (draft.screen !== "done") patchDraft({ screen: "done" });
      // Drop in-progress cookie; keep LS so Done UI still has the result.
      clearStartDraftCookie();
      return;
    }
    // Empty draft: only eject completed sellers/staff. Never bounce to /start or /onboarding
    // (same journey — that looped with the legacy onboarding redirect).
    const sameJourney =
      landingPath === "/start" ||
      landingPath === "/onboarding" ||
      Boolean(landingPath?.startsWith("/start?")) ||
      Boolean(landingPath?.startsWith("/start/")) ||
      Boolean(landingPath?.startsWith("/onboarding?")) ||
      Boolean(landingPath?.startsWith("/onboarding/"));
    if (signedIn && !draftHasProgress(draft) && landingPath && !sameJourney) {
      routedEmpty.current = true;
      router.replace(landingPath);
    }
  }, [hydrated, draft, signedIn, landingPath, router, patchDraft]);

  useEffect(() => {
    if (!hydrated || !draft || !signedIn || finalizing.current) return;
    if (draft.result) return;
    // If a previous mount's finalize is still running, `finalize()` joins that same call through
    // finalizeOnce (no second server action) so this mount still receives the result.
    const shouldFinalize =
      (draft.screen === "building" || draft.screen === "account") && draftReadyToFinalize(draft);
    if (!shouldFinalize) return;
    finalize();
  }, [hydrated, draft, signedIn, finalize]);

  const finishMessage = finalizeError !== null;
  // A finalize started by a previous mount of this journey is still running → keep the building UI.
  const finalizeInFlight = isFinalizeInFlight();
  const screen = draft.screen;
  const openingStore =
    (signedIn &&
      !draft.result &&
      !finishMessage &&
      draftReadyToFinalize(draft) &&
      (screen === "account" || screen === "building")) ||
    (finalizeInFlight && !draft.result && !finishMessage);

  function applyVoiceFacts(prevFacts: StartDraft["voice"]["facts"], patch: VoiceFacts): StartDraft["voice"]["facts"] {
    const merged = mergeFacts(
      {
        name: prevFacts.name,
        category: (prevFacts.category as VoiceFacts["category"]) ?? null,
        subcategory: prevFacts.subcategory,
        productsServices: prevFacts.productsServices,
        siteMode: prevFacts.siteMode,
        tagline: prevFacts.tagline,
        city: prevFacts.city,
        categories: prevFacts.categories ?? [],
        subcategories: prevFacts.subcategories ?? [],
      },
      patch,
    );
    return {
      ...prevFacts,
      name: merged.name,
      category: merged.category,
      subcategory: merged.subcategory,
      productsServices: merged.productsServices,
      siteMode: merged.siteMode,
      tagline: merged.tagline,
      city: merged.city,
      categories: [...(merged.categories ?? [])],
      subcategories: [...(merged.subcategories ?? [])],
    };
  }

  /** Quiz finish and Tara confirm both land here: identical draft fields, then the theme step. */
  function confirmStoreFacts(facts: StoreFacts, opts: { mode: "talk" | "quiz" }) {
    setDraft((d) => {
      const applied = applyStoreFacts(d, facts);
      return { ...applied, screen: "theme", voice: { ...applied.voice, done: true, mode: opts.mode } };
    });
    setStartDraftCookie();
    // Mark URL sync pending so we never re-adopt /quiz or /voice over theme.
    replaceStepUrl("theme");
  }

  const shell = (children: React.ReactNode, opts?: { layout?: "center" | "split"; screen?: StartScreen }) => (
    <StartShell
      draft={draft}
      screen={opts?.screen ?? screen}
      logo={logo}
      voiceEnabled={voiceEnabled}
      voiceAvailable={voiceReady}
      buildStep={buildStep}
      onVoiceToggle={() => setVoiceEnabled((v) => !v)}
      onLocaleChange={(code) => patchDraft({ locale: code })}
      layout={opts?.layout ?? "center"}
    >
      {children}
    </StartShell>
  );

  // Sync remap: never render an empty shell while waiting on the effect.
  const remapped = LEGACY_SCREEN_REMAP[screen] ?? screen;
  const renderScreen: StartScreen = remapped === "build" && !buildStep ? "path" : remapped;

  if (renderScreen === "lang") {
    return shell(
      <LangScreen
        locale={draft.locale as SarvamLocaleCode}
        onSelect={(code) => patchDraft({ locale: code })}
        onContinue={() => go(nextScreenAfterLang(buildStep))}
      />,
    );
  }

  if (renderScreen === "build") {
    return shell(
      <TypeSelector
        locale={draft.locale}
        onBack={() => go("lang")}
        onStore={() => {
          setDraft((d) => ({ ...d, screen: "path", business: { ...d.business, siteMode: "ecommerce" } }));
          setStartDraftCookie();
          replaceStepUrl("path");
        }}
        onInformative={() => router.push(informativeEntryHref(draft.locale))}
      />,
    );
  }

  if (renderScreen === "path") {
    const pathMode = !voiceReady ? "quiz" : (draft.voice.mode ?? "talk");
    return shell(
      <PathScreen
        locale={draft.locale}
        path={draft.path}
        mode={pathMode}
        voiceReady={voiceReady}
        onSelect={(choice) => {
          if (!voiceReady && choice.mode === "talk") return;
          patchDraft({
            path: choice.path,
            voice: { ...draft.voice, mode: choice.mode },
            business: { ...draft.business, siteMode: "ecommerce" },
          });
        }}
        onBack={() => {
          const t = backTarget("path", draft.path, draft.voice.mode, buildStep);
          if (t) go(t);
        }}
        onContinue={() => {
          if (!draft.path) return;
          const mode = voiceReady ? (draft.voice.mode ?? "talk") : "quiz";
          if (mode !== (draft.voice.mode ?? "talk")) {
            setDraft((d) => ({ ...d, voice: { ...d.voice, mode } }));
          }
          go(nextScreenAfterPath(draft.path, mode));
        }}
      />,
    );
  }

  // Step 4: voice (ai+talk) | quiz (ai+quiz; legacy manual "business" renders the quiz too)
  if (renderScreen === "voice") {
    // Spread so the voice screen can add/remove callbacks without breaking this file's types.
    // Contract: onConfirm(facts = { name, categories, subcategories, city, tagline? }) → same
    // draft fields as the quiz (applyStoreFacts) → theme.
    const voiceProps = {
      draft,
      voiceReady,
      voiceEnabled,
      onBack: () => {
        const t = backTarget("voice", draft.path, draft.voice.mode, buildStep);
        if (t) go(t);
      },
      onFacts: (facts: VoiceFacts, done: boolean, turns: StartVoiceTurn[]) => {
        setDraft((d) => ({ ...d, voice: { ...d.voice, facts: applyVoiceFacts(d.voice.facts, facts), done, turns } }));
      },
      onConfirm: (facts: StoreFacts) => confirmStoreFacts(facts, { mode: "talk" }),
      onDone: () => confirmStoreFacts(storeFactsFromDraft(draft), { mode: "talk" }),
      onManual: () => {
        setDraft((d) => ({ ...d, screen: "quiz", voice: { ...d.voice, mode: "quiz" } }));
        setStartDraftCookie();
        replaceStepUrl("quiz");
      },
      onQuiz: () => {
        setDraft((d) => ({ ...d, screen: "quiz", voice: { ...d.voice, mode: "quiz" } }));
        setStartDraftCookie();
        replaceStepUrl("quiz");
      },
    };
    return shell(<VoiceScreen {...voiceProps} />);
  }

  if (renderScreen === "quiz") {
    return shell(
      <QuizScreen
        draft={draft}
        onBack={() => {
          const t = backTarget("quiz", draft.path, draft.voice.mode, buildStep);
          if (t) go(t);
        }}
        onSave={(facts, done) => {
          if (done) {
            confirmStoreFacts(facts, { mode: "quiz" });
            return;
          }
          setDraft((d) => {
            const applied = applyStoreFacts(d, facts);
            return { ...applied, screen: "quiz", voice: { ...applied.voice, mode: "quiz" } };
          });
        }}
      />,
    );
  }

  if (renderScreen === "theme") {
    return shell(
      <ThemeScreen
        draft={draft}
        onPatch={(patch) => patchDraft(patch)}
        onBack={() => {
          const t = backTarget("theme", draft.path, draft.voice.mode, buildStep);
          if (t) go(t);
        }}
        onContinue={() => go("account")}
      />,
    );
  }

  if (!finishMessage && (renderScreen === "building" || openingStore)) {
    const waitForFinalize = Boolean(signedIn && draftReadyToFinalize(draft) && !draft.result);
    const stepCount = startCopy(draft.locale).building.steps.length;
    return shell(
      <BuildingScreen
        draft={draft}
        rootDomain={rootDomain}
        waitForFinalize={waitForFinalize}
        progress={
          waitForFinalize
            ? { stepIndex: phaseStepIndex(finalizeProgress.phase, stepCount), pct: phaseProgressPct(finalizeProgress) }
            : undefined
        }
        onComplete={() => {
          // Signed-in finalize is started by the effect above; only advance unsigned journeys here.
          if (!signedIn) go("account");
        }}
      />,
      { layout: "center" },
    );
  }

  if (finishMessage && signedIn && !draft.result && draftReadyToFinalize(draft)) {
    const stepCount = startCopy(draft.locale).building.steps.length;
    return shell(
      <BuildingScreen
        draft={draft}
        rootDomain={rootDomain}
        waitForFinalize
        progress={{ stepIndex: phaseStepIndex(finalizeProgress.phase, stepCount), pct: phaseProgressPct(finalizeProgress) }}
        failure={{ message: finalizeError ?? "", onRetry: () => finalize() }}
        onComplete={() => {}}
      />,
      { layout: "center" },
    );
  }

  if (renderScreen === "account" || (renderScreen === "building" && finishMessage)) {
    return shell(
      <>
        <AccountScreen
          draft={draft}
          rootDomain={rootDomain}
          googleAvailable={googleAvailable}
          onBack={() => {
            const t = backTarget(finishMessage ? "building" : "account", draft.path, draft.voice.mode);
            if (t) go(t);
          }}
        />
        {finishMessage ? (
          <div className="mx-auto mt-4 flex max-w-md justify-center">
            <button type="button" onClick={() => finalize()} className={onbButton.primary}>
              Try again
            </button>
          </div>
        ) : null}
      </>,
      { layout: "center", screen: "account" },
    );
  }

  const slug = draft.result?.slug ?? (suggestSlugFromName(draftStoreName(draft)) || "store");
  const storeName = draft.result?.name ?? draftStoreName(draft);
  return shell(
    <DoneScreen
      locale={draft.locale}
      slug={draft.result?.slug ?? slug}
      storeName={storeName}
      rootDomain={rootDomain}
      onLeave={() => {
        leavingDone.current = true;
        clearFinalizeProgress();
      }}
      onDashboard={() => {
        leavingDone.current = true;
        clearFinalizeProgress();
        // Hard nav avoids a soft-nav race with empty-draft redirect after clearing storage.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full page leave from Done
        window.location.assign("/dashboard");
        clearStartDraftStorage();
      }}
    />,
  );
}

export function restartStartJourney(plan?: string | null, theme?: string | null) {
  clearStartDraftStorage();
  clearFinalizeProgress();
  const d = emptyStartDraft({ plan, theme });
  return d;
}
