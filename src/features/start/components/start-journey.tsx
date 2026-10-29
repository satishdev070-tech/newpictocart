"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { finalizeStartDraftAction } from "../actions";
import type { ActionResult } from "@/lib/actions/result";
import type { FinalizeStartResult } from "../actions";
import { useStartDraft } from "../draft/use-start-draft";
import { clearStartDraftCookie, clearStartDraftStorage, setStartDraftCookie } from "../draft/storage";
import type { StartDraft, StartScreen } from "../draft/schema";
import { draftReadyToFinalize, draftHasProgress, backTarget, nextScreenAfterPath } from "../flow";
import { draftStoreName } from "../draft/schema";
import { suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { StartShell, type StartLogo } from "./start-shell";
import { LangScreen } from "../screens/lang-screen";
import { PathScreen } from "../screens/path-screen";
import { VoiceScreen } from "../screens/voice-screen";
import { QuizScreen } from "../screens/quiz-screen";
import { BusinessScreen } from "../screens/business-screen";
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

/** Legacy screens remapped into the five-screen graph (do not mount the old UIs). */
const LEGACY_SCREEN_REMAP: Partial<Record<StartScreen, StartScreen>> = {
  welcome: "lang",
  intent: "path",
  products: "business",
  mood: "theme",
  payment: "theme",
};

function urlStepFor(screen: StartScreen): StartStepId {
  const remapped = LEGACY_SCREEN_REMAP[screen] ?? screen;
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { draft, setDraft, patchDraft, hydrated } = useStartDraft({ plan, theme });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [finalizeState, setFinalizeState] = useState<ActionResult<FinalizeStartResult> | null>(null);
  const finalizing = useRef(false);
  const routedEmpty = useRef(false);
  const leavingDone = useRef(false);
  const bootstrapped = useRef(false);

  const replaceStepUrl = useCallback(
    (screen: StartScreen) => {
      const path = startStepPath(urlStepFor(screen));
      if (pathname !== path) router.replace(path);
    },
    [pathname, router],
  );

  const finalize = useCallback(() => {
    if (!draft || finalizing.current || draft.result) return;
    finalizing.current = true;
    setFinalizeState(null);
    const fd = new FormData();
    fd.set("draftJson", JSON.stringify(draft));
    void finalizeStartDraftAction(null, fd).then((res) => {
      setFinalizeState(res);
      if (res.ok) {
        setDraft((d) => ({ ...d, result: { slug: res.data.slug, name: res.data.name }, screen: "done" }));
        // Mid-journey gates should stop treating this as in-progress; keep LS for Done UI.
        clearStartDraftCookie();
      } else {
        finalizing.current = false;
        const message =
          res.error.fieldErrors?._form?.[0] ??
          (res.error.message === "Something went wrong. Please try again."
            ? "Your account is connected, but the store could not be finished. Try again."
            : res.error.message);
        toast.show({ tone: "error", message });
      }
    });
  }, [draft, setDraft, toast]);

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
  useEffect(() => {
    if (!hydrated || !draft) return;

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const remap = LEGACY_SCREEN_REMAP[draft.screen];
      const canonical = remap ?? draft.screen;
      const draftStep = urlStepFor(canonical);

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

    replaceStepUrl(draft.screen);
  }, [hydrated, draft, initialStep, patchDraft, replaceStepUrl]);


  // Voice path is gated by NEXT_PUBLIC_VOICE_ONBOARDING_ENABLED (default off).
  // Prefer quiz whenever the draft still holds talk mode on the path screen.
  useEffect(() => {
    if (!hydrated || !draft) return;
    if (draft.screen !== "path") return;
    if (process.env.NEXT_PUBLIC_VOICE_ONBOARDING_ENABLED === "true") return;
    if ((draft.voice.mode ?? "talk") !== "talk") return;
    setDraft((d) => {
      if (!d || d.screen !== "path") return d;
      if ((d.voice.mode ?? "talk") !== "talk") return d;
      return { ...d, voice: { ...d.voice, mode: "quiz" } };
    });
  }, [hydrated, draft, setDraft]);

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
    const shouldFinalize =
      (draft.screen === "building" || draft.screen === "account") && draftReadyToFinalize(draft);
    if (!shouldFinalize) return;
    finalize();
  }, [hydrated, draft, signedIn, finalize]);

  const finishMessage = finalizeState && !finalizeState.ok;
  const screen = draft.screen;
  const split = screen === "business";
  const openingStore =
    signedIn &&
    !draft.result &&
    !finishMessage &&
    draftReadyToFinalize(draft) &&
    (screen === "account" || screen === "building");

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
    };
  }

  function syncVoiceToBusiness(facts: VoiceFacts) {
    if (!draft) return;
    patchDraft({
      business: {
        ...draft.business,
        name: facts.name?.trim() || draft.business.name,
        tagline: facts.tagline?.trim() || draft.business.tagline,
        city: facts.city?.trim() || draft.business.city,
        category: facts.category ?? draft.business.category,
        subcategory: facts.subcategory ?? draft.business.subcategory,
        productsServices: facts.productsServices?.trim() || draft.business.productsServices,
        siteMode: facts.siteMode ?? draft.business.siteMode,
      },
    });
  }

  const shell = (children: React.ReactNode, opts?: { layout?: "center" | "split"; screen?: StartScreen }) => (
    <StartShell
      draft={draft}
      screen={opts?.screen ?? screen}
      logo={logo}
      voiceEnabled={voiceEnabled}
      onVoiceToggle={() => setVoiceEnabled((v) => !v)}
      onLangClick={() => go("lang")}
      layout={opts?.layout ?? (split ? "split" : "center")}
    >
      {children}
    </StartShell>
  );

  // Sync remap: never render an empty shell (white flash) while waiting on the effect.
  const renderScreen = LEGACY_SCREEN_REMAP[screen] ?? screen;

  if (renderScreen === "lang") {
    return shell(
      <LangScreen
        locale={draft.locale as SarvamLocaleCode}
        onSelect={(code) => patchDraft({ locale: code })}
        onContinue={() => go("path")}
      />,
    );
  }

  if (renderScreen === "path") {
    const voiceOnboardingEnabled = process.env.NEXT_PUBLIC_VOICE_ONBOARDING_ENABLED === "true";
    const pathMode =
      !voiceOnboardingEnabled && (draft.voice.mode ?? "talk") === "talk"
        ? "quiz"
        : (draft.voice.mode ?? "talk");
    return shell(
      <PathScreen
        locale={draft.locale}
        path={draft.path}
        mode={pathMode}
        onSelect={(choice) => {
          if (!voiceOnboardingEnabled && choice.mode === "talk") return;
          patchDraft({
            path: choice.path,
            voice: { ...draft.voice, mode: choice.mode },
          });
        }}
        onBack={() => {
          const t = backTarget("path", draft.path, draft.voice.mode);
          if (t) go(t);
        }}
        onContinue={() => {
          if (!draft.path) return;
          const mode =
            !voiceOnboardingEnabled
              ? "quiz"
              : (draft.voice.mode ?? "talk");
          if (!voiceOnboardingEnabled && (draft.voice.mode ?? "talk") === "talk") {
            patchDraft({ voice: { ...draft.voice, mode: "quiz" } });
          }
          go(nextScreenAfterPath(draft.path, mode));
        }}
      />,
    );
  }

  // Step 3: voice (ai+talk) | quiz (ai+quiz) | business (manual)
  if (renderScreen === "voice") {
    return shell(
      <VoiceScreen
        draft={draft}
        voiceReady={voiceReady}
        voiceEnabled={voiceEnabled}
        onBack={() => {
          const t = backTarget("voice", draft.path, draft.voice.mode);
          if (t) go(t);
        }}
        onFacts={(facts, done, turns: StartVoiceTurn[]) => {
          const nextFacts = applyVoiceFacts(draft.voice.facts, facts);
          patchDraft({
            voice: { facts: nextFacts, done, turns, mode: draft.voice.mode },
          });
          syncVoiceToBusiness(facts);
        }}
        onDone={() => {
          syncVoiceToBusiness({
            name: draft.voice.facts.name,
            category: (draft.voice.facts.category as VoiceFacts["category"]) ?? null,
            subcategory: draft.voice.facts.subcategory,
            productsServices: draft.voice.facts.productsServices,
            siteMode: draft.voice.facts.siteMode,
            tagline: draft.voice.facts.tagline,
            city: draft.voice.facts.city,
          });
          go("theme");
        }}
        onManual={() => {
          patchDraft({ path: "manual" });
          go("business");
        }}
        onQuiz={() => {
          setDraft((d) => ({ ...d, screen: "quiz", voice: { ...d.voice, mode: "quiz" } }));
          setStartDraftCookie();
        }}
      />,
    );
  }

  if (renderScreen === "quiz") {
    return shell(
      <QuizScreen
        draft={draft}
        onBack={() => {
          const t = backTarget("quiz", draft.path, draft.voice.mode);
          if (t) go(t);
        }}
        onSave={(facts, done) => {
          setDraft((d) => {
            const categoryChanged =
              facts.category != null && facts.category !== d.voice.facts.category;
            const nextFacts = applyVoiceFacts(d.voice.facts, facts);
            if (categoryChanged) {
              nextFacts.subcategory = facts.subcategory;
            }
            return {
              ...d,
              screen: done ? "theme" : "quiz",
              voice: {
                ...d.voice,
                facts: nextFacts,
                done: done || d.voice.done,
                mode: "quiz",
              },
              business: {
                ...d.business,
                name: facts.name?.trim() || d.business.name,
                tagline: facts.tagline?.trim() || d.business.tagline,
                city: facts.city?.trim() || d.business.city,
                category: facts.category ?? d.business.category,
                subcategory: categoryChanged
                  ? facts.subcategory
                  : (facts.subcategory ?? d.business.subcategory),
                productsServices: facts.productsServices?.trim() || d.business.productsServices,
                siteMode: facts.siteMode ?? d.business.siteMode,
              },
            };
          });
          if (done) setStartDraftCookie();
        }}
      />,
    );
  }

  if (renderScreen === "business") {
    return shell(
      <BusinessScreen
        draft={draft}
        voiceReady={voiceReady}
        rootDomain={rootDomain}
        onChange={(b) => patchDraft({ business: { ...draft.business, ...b } })}
        onBack={() => {
          const t = backTarget("business", draft.path, draft.voice.mode);
          if (t) go(t);
        }}
        onNext={() => go("theme")}
      />,
      { layout: "split" },
    );
  }

  if (renderScreen === "theme") {
    return shell(
      <ThemeScreen
        draft={draft}
        onPatch={(patch) => patchDraft(patch)}
        onBack={() => {
          const t = backTarget("theme", draft.path, draft.voice.mode);
          if (t) go(t);
        }}
        onContinue={() => go("account")}
      />,
    );
  }

  if (!finishMessage && (renderScreen === "building" || openingStore)) {
    const waitForFinalize = Boolean(signedIn && draftReadyToFinalize(draft) && !draft.result);
    return shell(
      <BuildingScreen
        draft={draft}
        rootDomain={rootDomain}
        waitForFinalize={waitForFinalize}
        onComplete={() => {
          // Signed-in finalize is started by the effect above; only advance unsigned journeys here.
          if (!signedIn) go("account");
        }}
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
          <div className="mx-auto mt-4 max-w-md space-y-3">
            <button
              type="button"
              onClick={() => finalize()}
              className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-5 py-2.5 text-sm font-semibold text-white"
            >
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
      onDashboard={() => {
        leavingDone.current = true;
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
  const d = emptyStartDraft({ plan, theme });
  return d;
}
