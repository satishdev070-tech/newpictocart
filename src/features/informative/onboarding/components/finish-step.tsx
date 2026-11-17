"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackInformativeEvent } from "../analytics";
import {
  buildInformativeOnboardingAiAction,
  createInformativeSiteAction,
  finishInformativeOnboardingAction,
  importInformativePhotosAction,
  saveInformativeSiteDetailsAction,
} from "../actions";
import { setSiteStatusAction } from "../../actions";
import type { FinishInfo } from "../completion";
import { INFO_PREVIEW_LOGO_KEY, START_TYPE_KEY, type InformativeDraft } from "../draft";
import {
  FINISH_PHASES,
  MAX_PHOTO_CALLS,
  canRunPhase,
  markPhaseDone,
  nextPhase,
  phaseStatuses,
  withPhaseRetry,
  type FinishPhase,
  type FinishProgress,
  type PhaseStatus,
} from "../phases";
import { OnbHeading, OnbSub } from "@/components/onboarding-ui";
import { ui } from "./shell";
import { infoCopy, infoErrorText, type InfoCopy } from "@/features/start/i18n/info-copy";
import { clearInformativeDraft } from "./use-draft";

/** Longest we wait for the AI to write the site; after that the starter content stays. */
const AI_BUILD_WAIT_MS = 75_000;

type Failure = { phase: FinishPhase; message: string; step: "basic-info" | "theme" | null };
type PhaseOutcome = { ok: true; progress: FinishProgress; info?: FinishInfo } | { ok: false; failure: Failure };

/** The draft as the server needs it outside the logo phase (no 700 KB logo, no local progress). */
function leanDraft(d: InformativeDraft) {
  const { finish: _finish, ...rest } = d;
  return { ...rest, logoDataUrl: null };
}

/**
 * Phased finish (phases.ts): create/resume → logo + language → photos in batches → AI (optional)
 * → finish, each a small server action retried with backoff. Progress is saved in the draft, so
 * "Try again" resumes from the phase that failed and never creates the site twice. Ends on a
 * "Your website is ready" panel: publish, open the dashboard, or preview.
 */
export function FinishStep({
  draft,
  setProgress,
  onEdit,
}: {
  draft: InformativeDraft;
  setProgress: (p: FinishProgress) => void;
  onEdit: (step: "basic-info" | "theme") => void;
}) {
  const router = useRouter();
  const c = infoCopy(draft.locale);
  const tx = c.finish;
  const draftRef = useRef(draft);
  const progressRef = useRef<FinishProgress>(draft.finish);
  const running = useRef(false);
  const [progress, setProgressState] = useState<FinishProgress>(draft.finish);
  const [active, setActive] = useState<FinishPhase | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [info, setInfo] = useState<FinishInfo | null>(null);

  // The parent passes a new callback each render; keep the latest without restarting the run.
  const setProgressRef = useRef(setProgress);
  useEffect(() => {
    setProgressRef.current = setProgress;
  }, [setProgress]);
  const started = useRef(false);

  const save = useCallback((p: FinishProgress) => {
    progressRef.current = p;
    setProgressState(p);
    setProgressRef.current(p);
  }, []);

  const runPhase = useCallback(async (phase: FinishPhase, p: FinishProgress): Promise<PhaseOutcome> => {
    const d = draftRef.current;
    const retry = { onRetry: () => setRetrying(true) };
    const fail = (error: { message: string; fieldErrors?: Record<string, string[]> }): PhaseOutcome => {
      const fe = error.fieldErrors ?? {};
      const step = phase !== "create" ? null : fe.themeId ? "theme" : Object.keys(fe).some((k) => k.startsWith("basic") || k === "slug") ? "basic-info" : null;
      return { ok: false, failure: { phase, message: Object.values(fe)[0]?.[0] ?? error.message, step } };
    };
    if (!canRunPhase(phase, p)) return { ok: false, failure: { phase, message: c.finish.failedSub, step: null } };
    const slug = p.slug ?? "";

    switch (phase) {
      case "create": {
        const r = await withPhaseRetry(() => createInformativeSiteAction({ draft: leanDraft(d) }), retry);
        if (!r.ok) return fail(r.error);
        trackInformativeEvent({ name: "informative_onboarding_completed", params: { themeId: r.data.themeId } });
        return { ok: true, progress: markPhaseDone(p, "create", { slug: r.data.slug }) };
      }
      case "details": {
        const r = await withPhaseRetry(() => saveInformativeSiteDetailsAction({ slug, logoDataUrl: d.logoDataUrl, locale: d.locale }), retry);
        if (!r.ok) return fail(r.error);
        return { ok: true, progress: markPhaseDone(p, "details") };
      }
      case "images": {
        let next = p;
        for (let i = 0; i < MAX_PHOTO_CALLS; i++) {
          const skip = next.failedPhotos;
          const r = await withPhaseRetry(() => importInformativePhotosAction({ slug, draft: leanDraft(d), skip }), retry);
          if (!r.ok) return fail(r.error);
          next = { ...next, failedPhotos: [...new Set([...next.failedPhotos, ...r.data.failed])].slice(0, 20) };
          save(next);
          if (r.data.remaining <= 0) break;
        }
        return { ok: true, progress: markPhaseDone(next, "images") };
      }
      case "ai": {
        // Optional: no retries (a rebuild costs a daily AI run); failure or timeout keeps the starter content.
        const r = await Promise.race([
          buildInformativeOnboardingAiAction({ slug, locale: d.locale }).catch(() => null),
          new Promise<null>((done) => setTimeout(() => done(null), AI_BUILD_WAIT_MS)),
        ]);
        const built = !!r && r.ok && r.data.built;
        return { ok: true, progress: markPhaseDone(p, "ai", { aiSkipped: !built }) };
      }
      case "finish": {
        const r = await withPhaseRetry(() => finishInformativeOnboardingAction({ slug }), retry);
        if (!r.ok) return fail(r.error);
        return { ok: true, progress: p, info: r.data };
      }
    }
  }, [c, save]);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setFailure(null);
    try {
      for (;;) {
        const phase = nextPhase(progressRef.current);
        setActive(phase);
        setRetrying(false);
        const out = await runPhase(phase, progressRef.current);
        if (!out.ok) {
          setFailure(out.failure);
          return;
        }
        save(out.progress);
        if (phase === "finish") {
          setInfo(out.info ?? null);
          return;
        }
      }
    } finally {
      setActive(null);
      setRetrying(false);
      running.current = false;
    }
  }, [runPhase, save]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  if (info) return <ReadyPanel c={c} info={info} aiSkipped={progress.aiSkipped} onLeave={(to) => leave(router, to)} />;

  const statuses = phaseStatuses(progress, active, failure?.phase ?? null, false);
  return (
    <section className={`${ui.card} flex flex-col gap-5`} aria-live="polite">
      <div className="flex flex-col gap-2 text-center">
        <OnbHeading className="text-[clamp(1.5rem,3vw,2rem)]">{failure ? tx.failed : active === "ai" ? tx.writing : tx.building}</OnbHeading>
        <OnbSub>{failure ? tx.failedSub : active === "ai" ? tx.writingSub : tx.buildingSub}</OnbSub>
      </div>
      <PhaseList c={c} statuses={statuses} />
      {retrying && !failure ? <p className="text-center text-sm text-mk-dim">{tx.retrying}</p> : null}
      {failure ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-red-400" role="alert">{infoErrorText(c, failure.message)}</p>
          {failure.step ? (
            <button type="button" className={ui.primaryBtn} onClick={() => onEdit(failure.step!)}>{tx.fix}</button>
          ) : (
            <button type="button" className={ui.primaryBtn} onClick={() => void run()}>{tx.retry}</button>
          )}
        </div>
      ) : null}
    </section>
  );
}

const PHASE_LABEL: Record<FinishPhase, keyof InfoCopy["finish"]> = {
  create: "stepCreate",
  details: "stepDetails",
  images: "stepPhotos",
  ai: "stepAi",
  finish: "stepFinish",
};

function PhaseList({ c, statuses }: { c: InfoCopy; statuses: Record<FinishPhase, PhaseStatus> }) {
  const tx = c.finish;
  const statusText: Record<PhaseStatus, string> = { pending: "", active: tx.statusActive, done: tx.statusDone, failed: tx.statusFailed, skipped: tx.statusSkipped };
  return (
    <ol className="flex flex-col gap-3" aria-label={tx.stepsLabel}>
      {FINISH_PHASES.map((ph) => {
        const s = statuses[ph];
        return (
          <li key={ph} className="flex items-center gap-3 text-sm" aria-current={s === "active" ? "step" : undefined}>
            <StatusIcon status={s} />
            <span className={s === "pending" ? "text-mk-dim" : s === "failed" ? "text-red-400" : "text-mk-text"}>{tx[PHASE_LABEL[ph]] as string}</span>
            {statusText[s] ? <span className="sr-only">({statusText[s]})</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StatusIcon({ status }: { status: PhaseStatus }) {
  const base = "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  switch (status) {
    case "done":
      return <span aria-hidden className={`${base} bg-mk-accent text-black`}>✓</span>;
    case "skipped":
      return <span aria-hidden className={`${base} border border-mk-line-strong text-mk-muted`}>–</span>;
    case "failed":
      return <span aria-hidden className={`${base} border border-red-400 text-red-400`}>!</span>;
    case "active":
      return <span aria-hidden className="size-6 shrink-0 animate-spin rounded-full border-[3px] border-mk-accent/20 border-t-mk-accent motion-reduce:animate-none" />;
    default:
      return <span aria-hidden className={`${base} border border-mk-line`} />;
  }
}

/** Drops the local onboarding state, then opens the panel. */
function leave(router: ReturnType<typeof useRouter>, to: string) {
  clearInformativeDraft();
  try {
    window.localStorage.removeItem(START_TYPE_KEY);
    window.sessionStorage.removeItem(INFO_PREVIEW_LOGO_KEY);
  } catch {
    // ignore
  }
  router.replace(to);
}

function ReadyPanel({ c, info, aiSkipped, onLeave }: { c: InfoCopy; info: FinishInfo; aiSkipped: boolean; onLeave: (to: string) => void }) {
  const tx = c.finish;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const publish = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("status", "PUBLISHED");
      const r = await setSiteStatusAction(null, fd).catch(() => null);
      if (r?.ok) onLeave(info.afterPublishUrl);
      else setError(tx.publishFailed);
    });
  };

  return (
    <section className={`${ui.card} flex flex-col items-center gap-5 text-center`} aria-live="polite">
      <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-mk-accent text-xl font-bold text-black">✓</span>
      <OnbHeading className="text-[clamp(1.5rem,3vw,2rem)]">{tx.readyTitle}</OnbHeading>
      <OnbSub>{info.published ? tx.readySubLive : tx.readySub}</OnbSub>
      {aiSkipped ? <p className="text-sm text-mk-dim">{tx.aiSkipped}</p> : null}
      {error ? <p className="text-red-400" role="alert">{error}</p> : null}
      <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
        {info.canPublish ? (
          <button type="button" className={ui.primaryBtn} onClick={publish} disabled={pending} aria-busy={pending}>
            {pending ? tx.publishing : tx.publish}
          </button>
        ) : null}
        <button type="button" className={info.canPublish ? ui.secondaryBtn : ui.primaryBtn} onClick={() => onLeave(info.dashboardUrl)} disabled={pending}>
          {tx.dashboard}
        </button>
        <a href={info.previewUrl} target="_blank" rel="noopener" className={ui.ghostBtn}>
          {tx.preview}
        </a>
      </div>
    </section>
  );
}
