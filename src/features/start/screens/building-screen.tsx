"use client";

import { useEffect, useRef, useState } from "react";
import { findTheme } from "@/features/marketing-site/themes";
import { ThemeDevicePreview } from "@/features/marketing-site/components/theme-card";
import { Check } from "lucide-react";
import { OnbCard, OnbEyebrow, OnbHeading } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { buildingProgressPct, buildingStepIndex } from "../building-progress";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";

export function BuildingScreen({
  draft,
  rootDomain: _rootDomain,
  onComplete,
  /** When true (signed-in finalize in flight), never claim 100% / call onComplete until the parent navigates away. */
  waitForFinalize = false,
}: {
  draft: StartDraft;
  rootDomain: string;
  onComplete: () => void;
  waitForFinalize?: boolean;
}) {
  void _rootDomain;
  const c = startCopy(draft.locale);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const stepCount = c.building.steps.length;

  const theme = draft.theme ? findTheme(draft.theme) : undefined;
  const storeLabel =
    draft.business.name.trim() ||
    draft.voice.facts.name?.trim() ||
    theme?.name.split(" ")[0] ||
    c.building.themeFallback;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
    let start = 0;
    let finish: number | undefined;
    const tick = window.setInterval(() => {
      if (!start) start = performance.now();
      const elapsed = performance.now() - start;
      setStep(buildingStepIndex(elapsed, stepCount));
      const p = buildingProgressPct(elapsed, waitForFinalize);
      setPct(p);
      if (!waitForFinalize && p >= 100) {
        window.clearInterval(tick);
        finish = window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onCompleteRef.current();
          }
        }, 280);
      }
    }, 80);
    return () => {
      window.clearInterval(tick);
      if (finish !== undefined) window.clearTimeout(finish);
    };
  }, [draft.locale, stepCount, waitForFinalize]);

  return (
    <section className="grid gap-8 pt-4 sm:pt-8 lg:grid-cols-2 lg:items-center" aria-live="polite">
      <div className="space-y-6">
        <div className="space-y-3">
          <OnbEyebrow>Pictocart</OnbEyebrow>
          <OnbHeading as="h2">{c.building.title}</OnbHeading>
        </div>

        <ul className="space-y-2">
          {c.building.steps.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--r-md)] border px-3 py-2.5 text-sm transition-[opacity,background-color,border-color] duration-500",
                  active
                    ? "border-mk-accent/50 bg-mk-accent-tint"
                    : done
                      ? "border-mk-line bg-mk-elev-1"
                      : "border-transparent opacity-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    done || active ? "bg-mk-accent text-mk-accent-ink" : "bg-mk-elev-2 text-mk-dim",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : active ? "●" : "○"}
                </span>
                <span className={active ? "font-semibold text-mk-text" : "text-mk-muted"}>{label}</span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="h-full rounded-full bg-mk-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <span className="min-w-[4ch] text-right font-mk-mono text-sm text-mk-muted">{pct}%</span>
          </div>
          {waitForFinalize ? <p className="text-sm text-mk-muted">{c.building.finishing}</p> : null}
        </div>
      </div>

      <OnbCard className="p-3 sm:p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mk-text">{theme?.name ?? c.building.themeFallback}</p>
              <p className="truncate text-xs text-mk-muted">{storeLabel}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-mk-line-strong px-2.5 py-1 font-mk-mono text-[10px] uppercase tracking-[0.14em] text-mk-muted">
              <span className="size-1.5 rounded-full bg-mk-accent motion-safe:animate-pulse" aria-hidden />
              {c.livePreview}
            </span>
          </div>
          {/* Light island: depicts the seller's (light) storefront. */}
          <div className="mk-light overflow-hidden rounded-[var(--r-md)] bg-white">
            {theme ? (
              <div className="max-h-[360px] overflow-hidden sm:max-h-[520px]">
                <ThemeDevicePreview theme={theme} size="large" eager />
              </div>
            ) : (
              <div className="grid min-h-[260px] place-items-center bg-brand-canvas p-8 text-center sm:min-h-[360px]">
                <div>
                  <p className="font-brand text-3xl font-semibold text-brand-ink">{storeLabel}</p>
                  <p className="mt-2 text-sm text-muted">{draft.business.tagline.trim() || c.building.themeFallback}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </OnbCard>
    </section>
  );
}
