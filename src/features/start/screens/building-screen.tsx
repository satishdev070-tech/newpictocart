"use client";

import { useEffect, useRef, useState } from "react";
import { startCopy } from "../copy";
import { LivePreview } from "../components/live-preview";
import type { StartDraft } from "../draft/schema";

export function BuildingScreen({
  draft,
  rootDomain,
  onComplete,
  /** When true (signed-in finalize in flight), never claim 100% / call onComplete until the parent navigates away. */
  waitForFinalize = false,
}: {
  draft: StartDraft;
  rootDomain: string;
  onComplete: () => void;
  waitForFinalize?: boolean;
}) {
  const c = startCopy(draft.locale);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const stepCount = c.building.steps.length;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    doneRef.current = false;
    const timers: number[] = [];
    for (let i = 0; i < stepCount; i += 1) {
      timers.push(window.setTimeout(() => setStep(i), i * 600));
    }
    const start = Date.now();
    let finish: number | undefined;
    // Soft ceiling while waiting on the server; only unsigned journeys finish on the timer.
    const softCap = waitForFinalize ? 92 : 100;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      // Progress over ~3s up to softCap; stay there until finalize returns when waitForFinalize.
      const p = Math.min(softCap, Math.round((elapsed / 3000) * softCap));
      setPct(p);
      if (!waitForFinalize && p >= 100) {
        window.clearInterval(tick);
        finish = window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onCompleteRef.current();
          }
        }, 200);
      }
    }, 80);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(tick);
      if (finish !== undefined) window.clearTimeout(finish);
    };
  }, [draft.locale, stepCount, waitForFinalize]);

  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <h2 className="font-brand text-3xl sm:text-4xl">{c.building.title}</h2>
        <ul className="space-y-3">
          {c.building.steps.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={cnDot(i <= step)}>{i < step ? "✓" : i === step ? "●" : "○"}</span>
              {label}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2A2233]/10">
            <div className="h-full rounded-full bg-linear-to-r from-[#FB923C] to-[#F97316] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-mono text-[#6B6275]">{pct}%</span>
        </div>
        {waitForFinalize ? <p className="text-sm text-[#6B6275]">Finishing your store…</p> : null}
      </div>
      <LivePreview locale={draft.locale} rootDomain={rootDomain} draft={draft} liveSlug={draft.result?.slug} />
    </section>
  );
}

function cnDot(active: boolean) {
  return active ? "grid size-6 place-items-center rounded-full bg-[#22C55E]/15 text-[#16A34A] text-xs" : "grid size-6 place-items-center text-[#94A3B8] text-xs";
}
