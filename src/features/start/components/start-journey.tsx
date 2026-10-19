"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { finalizeStartDraftAction } from "../actions";
import type { ActionResult } from "@/lib/actions/result";
import type { FinalizeStartResult } from "../actions";
import { useStartDraft } from "../draft/use-start-draft";
import { clearStartDraftStorage, setStartDraftCookie } from "../draft/storage";
import type { StartScreen } from "../draft/schema";
import { draftReadyToFinalize, draftHasProgress, backTarget } from "../flow";
import { draftStoreName } from "../draft/schema";
import { suggestSlugFromName } from "@/features/onboarding/voice/facts";
import { StartShell, type StartLogo } from "./start-shell";
import { WelcomeScreen } from "../screens/welcome-screen";
import { LangScreen } from "../screens/lang-screen";
import { IntentScreen } from "../screens/intent-screen";
import { PathScreen } from "../screens/path-screen";
import { VoiceScreen } from "../screens/voice-screen";
import { BusinessScreen } from "../screens/business-screen";
import { ProductsScreen } from "../screens/products-screen";
import { MoodScreen } from "../screens/mood-screen";
import { PaymentScreen } from "../screens/payment-screen";
import { BuildingScreen } from "../screens/building-screen";
import { AccountScreen } from "../screens/account-screen";
import { DoneScreen } from "../screens/done-screen";
import type { StartIntentId } from "../intents";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { VoiceFacts } from "@/features/onboarding/voice/facts";
import type { StartVoiceTurn } from "../draft/schema";
import { emptyStartDraft } from "../draft/schema";
import { mergeFacts } from "@/features/onboarding/voice/facts";

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

  if (!hydrated || !draft) {
    return <div className="min-h-dvh bg-[#FBF6F1]" />;
  }

  const screen = draft.screen;
  const split = ["business", "products", "mood", "account"].includes(screen);

  function syncVoiceToBusiness(facts: VoiceFacts) {
    if (!draft) return;
    patchDraft({
      business: {
        ...draft.business,
        name: facts.name?.trim() || draft.business.name,
        tagline: facts.tagline?.trim() || draft.business.tagline,
        city: facts.city?.trim() || draft.business.city,
        category: facts.category ?? draft.business.category,
        siteMode: facts.siteMode ?? draft.business.siteMode,
      },
    });
  }

  const shell = (children: React.ReactNode, opts?: { back?: boolean; layout?: "center" | "split" }) => (
    <StartShell
      draft={draft}
      screen={screen}
      logo={logo}
      voiceEnabled={voiceEnabled}
      onVoiceToggle={() => setVoiceEnabled((v) => !v)}
      onBack={opts?.back ? () => { const t = backTarget(screen, draft.path); if (t) go(t); } : undefined}
      onLangClick={() => go("lang")}
      layout={opts?.layout ?? (split ? "split" : "center")}
    >
      {children}
    </StartShell>
  );

  if (screen === "welcome") {
    return shell(
      <WelcomeScreen
        locale={draft.locale}
        onBegin={() => {
          setStartDraftCookie();
          go("lang");
        }}
      />,
    );
  }

  if (screen === "lang") {
    return shell(
      <LangScreen
        locale={draft.locale as SarvamLocaleCode}
        onSelect={(code) => patchDraft({ locale: code })}
        onContinue={() => go("intent")}
      />,
      { back: true },
    );
  }

  if (screen === "intent") {
    return shell(
      <IntentScreen
        locale={draft.locale}
        intent={draft.intent as StartIntentId | null}
        onSelect={(id) => patchDraft({ intent: id })}
        onContinue={() => go("path")}
      />,
      { back: true },
    );
  }

  if (screen === "path") {
    return shell(
      <PathScreen
        locale={draft.locale}
        path={draft.path}
        onSelect={(p) => patchDraft({ path: p })}
        onContinue={() => {
          if (draft.path === "ai") go("voice");
          else go("business");
        }}
      />,
      { back: true },
    );
  }

  if (screen === "voice") {
    return shell(
      <VoiceScreen
        draft={draft}
        voiceReady={voiceReady}
        voiceEnabled={voiceEnabled}
        onFacts={(facts, done, turns: StartVoiceTurn[]) => {
          patchDraft({
            voice: { facts: mergeFacts(draft.voice.facts as VoiceFacts, facts), done, turns },
          });
          syncVoiceToBusiness(facts);
        }}
        onDone={() => {
          syncVoiceToBusiness(draft.voice.facts as VoiceFacts);
          go("building");
        }}
        onManual={() => {
          patchDraft({ path: "manual" });
          go("business");
        }}
        onQuiz={() => {
          patchDraft({ path: "manual" });
          go("business");
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
        onNext={() => go(draft.path === "ai" ? "building" : "products")}
      />,
      { back: true, layout: "split" },
    );
  }

  if (screen === "products") {
    return shell(
      <ProductsScreen
        draft={draft}
        rootDomain={rootDomain}
        onChange={(products) => patchDraft({ products })}
        onNext={() => go("mood")}
      />,
      { back: true, layout: "split" },
    );
  }

  if (screen === "mood") {
    return shell(
      <MoodScreen
        draft={draft}
        rootDomain={rootDomain}
        onSelect={(mood) => patchDraft({ mood })}
        onAccent={(accent) => patchDraft({ accent })}
        onNext={() => go("payment")}
      />,
      { back: true, layout: "split" },
    );
  }

  if (screen === "payment") {
    return shell(
      <PaymentScreen
        draft={draft}
        onChange={(p) => patchDraft({ payment: { ...draft.payment, ...p } })}
        onNext={() => go("building")}
      />,
      { back: true },
    );
  }

  if (screen === "building") {
    return shell(
      <BuildingScreen
        draft={draft}
        rootDomain={rootDomain}
        onComplete={() => {
          if (signedIn && draftReadyToFinalize(draft)) finalize();
          else if (!signedIn) go("account");
        }}
      />,
      { back: true },
    );
  }

  if (screen === "account") {
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
      { back: true, layout: "split" },
    );
  }

  const slug = draft.result?.slug ?? (suggestSlugFromName(draftStoreName(draft)) || "store");
  return shell(
    <DoneScreen
      locale={draft.locale}
      slug={draft.result?.slug ?? slug}
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
