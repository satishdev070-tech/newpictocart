"use client";

import { useState, useTransition } from "react";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshBusinessCoachAction } from "@/features/seller-ai/actions";
import type { BusinessCoachResult } from "@/features/seller-ai/schemas";

const priorityTone = { high: "bg-error/10 text-error", medium: "bg-warning/10 text-warning", low: "bg-surface-secondary text-muted" } as const;

export type BusinessCoachText = { title: string; description: string; empty: string; get: string; refresh: string; thinking: string; high: string; medium: string; low: string };

/**
 * "AI Business Coach": a short checklist from the store's real numbers, written in the seller's
 * panel language (the server reads pc_lang; nothing language-related is trusted from here).
 */
export function BusinessCoachCard({ text }: { text: BusinessCoachText }) {
  const [result, setResult] = useState<BusinessCoachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    start(async () => {
      const r = await refreshBusinessCoachAction();
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        return;
      }
      setResult(r.data);
    });
  };

  return (
    <section data-tour="ai-coach" className="rounded-xl border border-[#c4b5fd]/60 bg-gradient-to-br from-[#f5f3ff] to-[#fdf4ff] shadow-xs dark:border-[#7c3aed]/40 dark:from-[#7c3aed]/10 dark:to-[#c026d3]/5">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 gap-2.5">
          <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-[#7c3aed]" />
          <div className="min-w-0">
            <h2 className="text-h3">{text.title}</h2>
            <p className="mt-0.5 text-caption text-muted">{text.description}</p>
          </div>
        </div>
        {result ? (
          <button type="button" onClick={run} disabled={pending} aria-label={text.refresh} title={text.refresh} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#7c3aed] hover:bg-[#7c3aed]/10 disabled:opacity-50">
            <RefreshCw aria-hidden className={`size-4 ${pending ? "animate-spin" : ""}`} />
          </button>
        ) : null}
      </header>
      <div className="space-y-3 p-4 sm:p-5">
        {error ? (
          <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
            {error}
          </p>
        ) : null}
        {!result ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-small text-muted">{text.empty}</p>
            <Button type="button" size="sm" variant="secondary" pending={pending} onClick={run}>
              {pending ? text.thinking : text.get}
            </Button>
          </div>
        ) : (
          <>
            <div>
              <p className="font-medium">{result.headline}</p>
              {result.focus ? <p className="mt-1 text-small text-muted">{result.focus}</p> : null}
            </div>
            <ul className="space-y-2" aria-busy={pending || undefined}>
              {result.tips.map((t, i) => (
                <li key={`${t.title}-${i}`} className="flex gap-3 rounded-lg border border-[#c4b5fd]/50 bg-surface/80 px-3 py-2.5 text-small dark:border-[#7c3aed]/30">
                  <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-[#7c3aed]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t.title}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priorityTone[t.priority]}`}>{text[t.priority]}</span>
                    </span>
                    <span className="mt-0.5 block text-muted">{t.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
