"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackInformativeEvent } from "../analytics";
import { completeInformativeOnboardingAction } from "../actions";
import { buildInformativeSiteWithAiAction } from "../../ai/actions";
import { INFO_PREVIEW_LOGO_KEY, START_TYPE_KEY, type InformativeDraft } from "../draft";
import { ui } from "./shell";
import { clearInformativeDraft } from "./use-draft";

/** Longest we wait for the AI to write the site before opening the dashboard with the starter content. */
const AI_BUILD_WAIT_MS = 75_000;

/**
 * Completes onboarding once (guarded against double submits; the server is idempotent too), then
 * asks the AI to write the site for this business (free right after signup). If AI isn't available
 * or takes too long, the ready-made starter content stays and the dashboard opens anyway.
 */
export function FinishStep({ draft, onEdit }: { draft: InformativeDraft; onEdit: (step: "basic-info" | "theme") => void }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<{ message: string; step: "basic-info" | "theme" | null } | null>(null);
  const [phase, setPhase] = useState<"create" | "ai">("create");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const r = await completeInformativeOnboardingAction({ draft });
      if (r.ok) {
        trackInformativeEvent({ name: "informative_onboarding_completed", params: { themeId: r.data.themeId } });
        clearInformativeDraft();
        try {
          window.localStorage.removeItem(START_TYPE_KEY);
          window.sessionStorage.removeItem(INFO_PREVIEW_LOGO_KEY);
        } catch {
          // ignore
        }
        setPhase("ai");
        await Promise.race([buildInformativeSiteWithAiAction({ onboarding: true }).catch(() => null), new Promise((done) => setTimeout(done, AI_BUILD_WAIT_MS))]);
        router.replace(r.data.redirectTo);
        return;
      }
      const fe = r.error.fieldErrors ?? {};
      const first = Object.values(fe)[0]?.[0];
      const step = fe.themeId ? "theme" : Object.keys(fe).some((k) => k.startsWith("basic") || k === "slug") ? "basic-info" : null;
      setError({ message: first ?? r.error.message, step });
    })();
  }, [draft, router]);

  return (
    <section className={`${ui.card} flex flex-col items-center gap-4 text-center`} aria-live="polite">
      {error ? (
        <>
          <h1 className="font-brand text-3xl">We couldn&apos;t create your website</h1>
          <p className="text-[#5E5568]" role="alert">{error.message}</p>
          {error.step ? (
            <button type="button" className={ui.primaryBtn} onClick={() => onEdit(error.step!)}>Fix it</button>
          ) : (
            <button type="button" className={ui.primaryBtn} onClick={() => window.location.reload()}>Try again</button>
          )}
        </>
      ) : (
        <>
          <span aria-hidden className="size-10 animate-spin rounded-full border-4 border-[#C2410C]/20 border-t-[#C2410C] motion-reduce:animate-none" />
          <h1 className="font-brand text-3xl">{phase === "create" ? "Building your website…" : "Writing your website with AI…"}</h1>
          <p className="text-[#5E5568]">
            {phase === "create" ? "Setting up your pages and services. This takes a few seconds." : "Tailoring your About page, services and FAQs to your business. This can take up to a minute."}
          </p>
        </>
      )}
    </section>
  );
}
