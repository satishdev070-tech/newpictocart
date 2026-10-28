"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { finalizeStartDraftAction } from "../actions";
import type { ActionResult } from "@/lib/actions/result";
import type { FinalizeStartResult } from "../actions";
import { useStartDraft } from "../draft/use-start-draft";
import { clearStartDraftStorage, setStartDraftCookie } from "../draft/storage";
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

/** Legacy screens remapped into the five-screen graph (do not mount the old UIs). */
const LEGACY_SCREEN_REMAP: Partial<Record<StartScreen, StartScreen>> = {
  welcome: "lang",
  intent: "path",
  products: "business",
  mood: "theme",
  payment: "theme",
};

export function StartJourney({
  plan,
  theme,
  signedIn,
  landingPath,
  logo,
  rootDomain,
  googleAvailable,
  voiceReady,
}: {
  plan?: string | null;
  theme?: string | null;
  signedIn: boolean;
  landingPath: string | null;
  logo: StartLogo;
  rootDomain: string;
  googleAvailable: boolean;
  voiceReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { draft, setDraft, patchDraft, hydrated } = useStartDraft({ plan, theme });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [finalizeState, setFinalizeState] = useState<ActionResult<FinalizeStartResult> | null>(null);
  const finalizing = useRef(false);
  const routedEmpty = useRef(false);

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
      if (screen !== "welcome") setStartDraftCookie();
      setDraft(next);
    },
    [draft, setDraft],
  );

  useEffect(() => {
    if (!hydrated || !draft) return;
    const remap = LEGACY_SCREEN_REMAP[draft.screen];
    if (remap) patchDraft({ screen: remap });
  }, [hydrated, draft, patchDraft]);

  useEffect(() => {
    if (!hydrated || !draft || routedEmpty.current) return;
    if (signedIn && draft.result) {
      if (draft.screen !== "done") patchDraft({ screen: "done" });
      return;
    }
    if (signedIn && !draftHasProgress(draft) && landingPath) {
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
  const split = screen === "business" || screen === "account";
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

  const shell = (children: React.ReactNode, opts?: { back?: boolean; layout?: "center" | "split"; backTo?: StartScreen; screen?: StartScreen }) => (
    <StartShell
      draft={draft}
      screen={opts?.screen ?? screen}
      logo={logo}
      voiceEnabled={voiceEnabled}
      onVoiceToggle={() => setVoiceEnabled((v) => !v)}
      onBack={
        opts?.back
          ? () => {
              const t = backTarget(opts.backTo ?? screen, draft.path, draft.voice.mode);
              if (t) go(t);
            }
          : undefined
      }
      onLangClick={() => go("lang")}
      layout={opts?.layout ?? (split ? "split" : "center")}
    >
      {children}
    </StartShell>
  );

  // Remap in progress — avoid flashing legacy screen ids before patch lands.
  if (LEGACY_SCREEN_REMAP[screen]) {
    return shell(null);
  }

  if (screen === "lang") {
    return shell(
      <LangScreen
        locale={draft.locale as SarvamLocaleCode}
        onSelect={(code) => patchDraft({ locale: code })}
        onContinue={() => go("path")}
      />,
    );
  }

  if (screen === "path") {
    return shell(
      <PathScreen
        locale={draft.locale}
        path={draft.path}
        mode={draft.voice.mode ?? "talk"}
        onSelect={(choice) =>
          patchDraft({
            path: choice.path,
            voice: { ...draft.voice, mode: choice.mode },
          })
        }
        onContinue={() => {
          if (!draft.path) return;
          go(nextScreenAfterPath(draft.path, draft.voice.mode ?? "talk"));
        }}
      />,
      { back: true },
    );
  }

  // Step 3: voice (ai+talk) | quiz (ai+quiz) | business (manual)
  if (screen === "voice") {
    return shell(
      <VoiceScreen
        draft={draft}
        voiceReady={voiceReady}
        voiceEnabled={voiceEnabled}
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
      { back: true },
    );
  }

  if (screen === "quiz") {
    return shell(
      <QuizScreen
        draft={draft}
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
      { back: true },
    );
  }

  if (screen === "business") {
    return shell(
      <BusinessScreen
        draft={draft}
        voiceReady={voiceReady}
        rootDomain={rootDomain}
        onChange={(b) => patchDraft({ business: { ...draft.business, ...b } })}
        onNext={() => go("theme")}
      />,
      { back: true, layout: "split" },
    );
  }

  if (screen === "theme") {
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
      { back: true },
    );
  }

  if (!finishMessage && (screen === "building" || openingStore)) {
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
      { back: !openingStore, layout: "center" },
    );
  }

  if (screen === "account" || (screen === "building" && finishMessage)) {
    return shell(
      <>
        <AccountScreen draft={draft} rootDomain={rootDomain} googleAvailable={googleAvailable} />
        {finishMessage ? (
          <div className="mt-4 space-y-3">
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
      { back: true, layout: "split", backTo: finishMessage ? "building" : "account", screen: "account" },
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
        clearStartDraftStorage();
        router.push("/dashboard");
      }}
    />,
  );
}

export function restartStartJourney(plan?: string | null, theme?: string | null) {
  clearStartDraftStorage();
  const d = emptyStartDraft({ plan, theme });
  return d;
}
