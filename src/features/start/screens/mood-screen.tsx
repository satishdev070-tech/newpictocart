"use client";

import { cn } from "@/lib/cn";
import { ACCENT_SWATCHES, START_MOODS } from "../moods";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { LivePreview } from "../components/live-preview";
import { progressFor } from "../flow";

export function MoodScreen({
  draft,
  rootDomain,
  onSelect,
  onAccent,
  onNext,
}: {
  draft: StartDraft;
  rootDomain: string;
  onSelect: (mood: string) => void;
  onAccent: (accent: string) => void;
  onNext: () => void;
}) {
  const c = startCopy(draft.locale);
  const manual = progressFor("mood", draft.path, draft.locale).manual;
  const host = draft.business.name.trim() ? `${draft.business.name.toLowerCase().replace(/\s+/g, "")}.${rootDomain}` : null;
  const hi = draft.locale === "hi-IN";

  return (
    <>
      <div className="flex flex-col gap-6">
        {manual ? <p className="text-xs text-[#6B6275]">{manual}</p> : null}
        <h2 className="font-brand text-3xl">
          {c.mood.title}
          <span className="text-[#C2410C]">{c.mood.titleAccent}</span>
        </h2>
        <p className="text-sm text-[#5E5568]">{c.mood.sub}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {START_MOODS.map((m) => {
            const active = draft.mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn(
                  "relative rounded-2xl border p-3 text-left transition",
                  active ? "border-[#F97316] shadow-md" : "border-white/90 bg-white/60",
                )}
                style={{ backgroundColor: m.bg }}
              >
                <span className="text-lg font-serif">Aa</span>
                <div className="mt-6 flex gap-1">
                  <span className="size-3 rounded-full" style={{ background: m.accentA }} />
                  <span className="size-3 rounded-full" style={{ background: m.accentB }} />
                </div>
                <p className="mt-2 text-sm font-medium">{hi ? m.labelHi : m.labelEn}</p>
                {active ? <span className="absolute bottom-2 right-2 grid size-5 place-items-center rounded-full bg-[#F97316] text-[10px] text-white">✓</span> : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{c.mood.accent}</span>
          {ACCENT_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onAccent(color)}
              className={cn("size-8 rounded-full border-2", draft.accent === color ? "border-white ring-2 ring-[#F97316]" : "border-transparent")}
              style={{ background: color }}
              aria-label={color}
            />
          ))}
        </div>
        <button type="button" disabled={!draft.mood} onClick={onNext} className="rounded-full bg-[#F97316] px-7 py-3 font-semibold text-white disabled:opacity-40">
          {c.mood.next}
        </button>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} host={host} productCount={draft.products.length} />
      </div>
    </>
  );
}
