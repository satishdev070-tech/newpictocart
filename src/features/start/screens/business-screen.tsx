"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { INDUSTRIES, type IndustrySlug } from "@/features/stores/industries";
import { subcategoriesFor } from "@/features/stores/subcategories";
import { startSuggestAction } from "../actions";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { LivePreview } from "../components/live-preview";
import { businessComplete, progressFor } from "../flow";

const FEATURED: IndustrySlug[] = ["fashion", "jewellery", "home-decor", "grocery", "beauty", "handicrafts"];

export function BusinessScreen({
  draft,
  voiceReady,
  rootDomain,
  onChange,
  onBack,
  onNext,
}: {
  draft: StartDraft;
  voiceReady: boolean;
  rootDomain: string;
  onChange: (patch: Partial<StartDraft["business"]>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const c = startCopy(draft.locale);
  const manual = progressFor("business", draft.path, draft.locale).manual;
  const [moreOpen, setMoreOpen] = useState(false);
  const b = draft.business;
  const subs = b.category ? subcategoriesFor(b.category) : [];
  const canContinue = businessComplete(draft);

  async function writeTagline() {
    const fd = new FormData();
    fd.set("locale", draft.locale);
    fd.set("kind", "tagline");
    if (b.category) fd.set("category", b.category);
    const res = await startSuggestAction(null, fd);
    if (res?.ok && res.data.text) onChange({ tagline: res.data.text });
    else if (!voiceReady) {
      onChange({ tagline: b.category === "handicrafts" ? "Handcrafted in India" : "Quality you can trust" });
    }
  }

  function selectCategory(slug: IndustrySlug) {
    onChange({
      category: slug,
      subcategory: b.category === slug ? b.subcategory : null,
    });
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {manual ? <p className="text-xs font-medium text-[#6B6275]">{manual}</p> : null}
        <h2 className="font-brand text-3xl sm:text-4xl">
          {c.business.title}
          <span className="text-[#C2410C]">{c.business.titleAccent}</span>
        </h2>
        <div className="space-y-4 rounded-[28px] border border-white/90 bg-white/70 p-5 shadow-sm">
          <label className="block text-sm font-medium">
            {c.business.storeName}
            <input
              value={b.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2A2233]/10 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-center justify-between">
              {c.business.tagline}
              <button type="button" onClick={() => void writeTagline()} className="text-xs font-semibold text-[#C2410C]">
                {c.business.writeAi}
              </button>
            </span>
            <input
              value={b.tagline}
              onChange={(e) => onChange({ tagline: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#2A2233]/10 px-3 py-2.5"
            />
          </label>
          <div>
            <p className="text-sm font-medium">{c.business.category}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEATURED.map((slug) => {
                const ind = INDUSTRIES.find((i) => i.slug === slug)!;
                const active = b.category === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => selectCategory(slug)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm",
                      active ? "bg-[#2A2233] text-white" : "bg-white border border-[#2A2233]/10",
                    )}
                  >
                    {draft.locale === "hi-IN" ? ind.short : ind.name}
                  </button>
                );
              })}
              <button type="button" onClick={() => setMoreOpen(!moreOpen)} className="rounded-full border border-dashed px-3 py-1.5 text-sm text-[#6B6275]">
                +
              </button>
            </div>
            {moreOpen ? (
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {INDUSTRIES.filter((i) => !FEATURED.includes(i.slug)).map((ind) => (
                  <button
                    key={ind.slug}
                    type="button"
                    onClick={() => selectCategory(ind.slug)}
                    className={cn("rounded-full px-2.5 py-1 text-xs", b.category === ind.slug ? "bg-[#F97316] text-white" : "bg-[#F4F0FA]")}
                  >
                    {ind.short}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {b.category ? (
            <div>
              <p className="text-sm font-medium">{c.business.subcategory}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {subs.map((sub) => {
                  const active = b.subcategory === sub.slug;
                  return (
                    <button
                      key={sub.slug}
                      type="button"
                      onClick={() => onChange({ subcategory: sub.slug })}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm",
                        active ? "bg-[#F97316] text-white" : "bg-white border border-[#2A2233]/10",
                      )}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <label className="block text-sm font-medium">
            {c.business.productsServices}
            <textarea
              value={b.productsServices}
              onChange={(e) => onChange({ productsServices: e.target.value })}
              rows={3}
              placeholder={c.business.productsServicesHint}
              className="mt-1 w-full rounded-xl border border-[#2A2233]/10 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm font-medium">
            {c.business.city}
            <input value={b.city} onChange={(e) => onChange({ city: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium">
            {c.business.whatsapp}
            <input value={b.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/90 bg-white/60 px-5 py-3 text-sm font-medium text-[#5E5568]"
          >
            ← {c.back}
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onNext}
            className="rounded-full bg-[#F97316] px-7 py-3.5 font-semibold text-white disabled:opacity-40"
          >
            {c.business.next}
          </button>
        </div>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} rootDomain={rootDomain} draft={draft} />
      </div>
    </>
  );
}
