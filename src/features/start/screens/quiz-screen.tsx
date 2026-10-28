"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { INDUSTRIES, isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { subcategoriesFor } from "@/features/stores/subcategories";
import type { SiteMode } from "@/features/stores/site-mode";
import { type VoiceFacts } from "@/features/onboarding/voice/facts";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { voiceFactsComplete } from "../flow";

const FEATURED: IndustrySlug[] = ["fashion", "jewellery", "home-decor", "grocery", "beauty", "handicrafts"];
/** name → category → subcategory → siteMode → city → tagline */
const STEPS = 6;

export function QuizScreen({
  draft,
  onSave,
}: {
  draft: StartDraft;
  onSave: (facts: VoiceFacts, done: boolean) => void;
}) {
  const c = startCopy(draft.locale);
  const [step, setStep] = useState(() =>
    firstOpenStep(
      draft.voice.facts.name,
      draft.voice.facts.category,
      draft.voice.facts.subcategory,
      draft.voice.facts.siteMode,
    ),
  );
  const [more, setMore] = useState(false);
  const [name, setName] = useState(draft.voice.facts.name ?? draft.business.name);
  const [city, setCity] = useState(draft.voice.facts.city ?? draft.business.city);
  const [tagline, setTagline] = useState(draft.voice.facts.tagline ?? draft.business.tagline);
  const facts = draft.voice.facts;
  const category = facts.category && isIndustry(facts.category) ? facts.category : null;
  const subs = category ? subcategoriesFor(category) : [];

  function current(patch: Partial<VoiceFacts> = {}): VoiceFacts {
    return {
      name: (patch.name ?? name).trim() || null,
      category: patch.category !== undefined ? patch.category : category,
      subcategory: patch.subcategory !== undefined ? patch.subcategory : facts.subcategory,
      productsServices:
        patch.productsServices !== undefined ? patch.productsServices : facts.productsServices,
      siteMode: patch.siteMode !== undefined ? patch.siteMode : facts.siteMode,
      city: (patch.city ?? city).trim() || null,
      tagline: (patch.tagline ?? tagline).trim() || null,
    };
  }

  function chooseCategory(slug: IndustrySlug) {
    const nextFacts = current({
      category: slug,
      subcategory: category === slug ? facts.subcategory : null,
    });
    onSave(nextFacts, false);
  }

  function chooseSubcategory(slug: string) {
    onSave(current({ subcategory: slug }), false);
  }

  function chooseSite(mode: SiteMode) {
    onSave(current({ siteMode: mode }), false);
  }

  function next() {
    const nextFacts = current();
    if (step < STEPS - 1) {
      onSave(nextFacts, false);
      setStep((s) => s + 1);
      return;
    }
    // Done when name + category + subcategory are set (siteMode defaults at finalize).
    const draftLike = {
      ...draft,
      voice: { ...draft.voice, facts: nextFacts },
      business: {
        ...draft.business,
        name: nextFacts.name?.trim() || draft.business.name,
        category: nextFacts.category ?? draft.business.category,
        subcategory: nextFacts.subcategory ?? draft.business.subcategory,
      },
    };
    onSave(nextFacts, voiceFactsComplete(draftLike));
  }

  const canNext =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && Boolean(category)) ||
    (step === 2 && Boolean(facts.subcategory?.trim())) ||
    (step === 3 && Boolean(facts.siteMode)) ||
    step >= 4;

  const categories = more ? INDUSTRIES : INDUSTRIES.filter((ind) => FEATURED.includes(ind.slug) || ind.slug === category);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <p className="text-xs font-semibold tracking-wide text-[#6B6275]">{c.quiz.step(step + 1, STEPS)}</p>
      {step === 0 ? (
        <Question title={c.quiz.nameTitle}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={c.quiz.nameHint}
            className="w-full rounded-2xl border border-[#2A2233]/10 bg-white px-4 py-3 text-base"
            autoFocus
          />
        </Question>
      ) : null}
      {step === 1 ? (
        <Question title={c.quiz.categoryTitle}>
          <div className="flex flex-wrap gap-2">
            {categories.map((ind) => (
              <button
                key={ind.slug}
                type="button"
                onClick={() => chooseCategory(ind.slug)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  category === ind.slug ? "border-[#F97316] bg-[#FFF7ED] font-semibold text-[#C2410C]" : "border-[#2A2233]/10 bg-white",
                )}
              >
                {ind.short}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMore((v) => !v)} className="text-sm text-[#C2410C] underline">
            {more ? c.quiz.less : c.quiz.more}
          </button>
        </Question>
      ) : null}
      {step === 2 ? (
        <Question title={c.quiz.subcategoryTitle}>
          <div className="flex flex-wrap gap-2">
            {subs.map((sub) => (
              <button
                key={sub.slug}
                type="button"
                onClick={() => chooseSubcategory(sub.slug)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  facts.subcategory === sub.slug
                    ? "border-[#F97316] bg-[#FFF7ED] font-semibold text-[#C2410C]"
                    : "border-[#2A2233]/10 bg-white",
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </Question>
      ) : null}
      {step === 3 ? (
        <Question title={c.quiz.siteTitle}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              active={facts.siteMode === "ecommerce"}
              title={c.quiz.storeTitle}
              desc={c.quiz.storeDesc}
              onClick={() => chooseSite("ecommerce")}
            />
            <Choice
              active={facts.siteMode === "informative"}
              title={c.quiz.siteInfoTitle}
              desc={c.quiz.siteInfoDesc}
              onClick={() => chooseSite("informative")}
            />
          </div>
        </Question>
      ) : null}
      {step === 4 ? (
        <Question title={c.quiz.cityTitle}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={c.quiz.cityHint}
            className="w-full rounded-2xl border border-[#2A2233]/10 bg-white px-4 py-3 text-base"
          />
        </Question>
      ) : null}
      {step === 5 ? (
        <Question title={c.quiz.taglineTitle}>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={c.quiz.taglineHint}
            className="w-full rounded-2xl border border-[#2A2233]/10 bg-white px-4 py-3 text-base"
          />
        </Question>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        {step >= 4 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 4) setCity("");
              if (step === 5) setTagline("");
              const cleared = current(step === 4 ? { city: "" } : { tagline: "" });
              if (step < STEPS - 1) {
                onSave(cleared, false);
                setStep((s) => s + 1);
              } else {
                const draftLike = {
                  ...draft,
                  voice: { ...draft.voice, facts: cleared },
                  business: {
                    ...draft.business,
                    name: cleared.name?.trim() || draft.business.name,
                    category: cleared.category ?? draft.business.category,
                    subcategory: cleared.subcategory ?? draft.business.subcategory,
                  },
                };
                onSave(cleared, voiceFactsComplete(draftLike));
              }
            }}
            className="text-sm text-[#6B6275] underline"
          >
            {c.quiz.skip}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!canNext}
          onClick={next}
          className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          {step === STEPS - 1 ? c.quiz.finish : c.quiz.next}
        </button>
      </div>
    </section>
  );
}

function firstOpenStep(
  name: string | null,
  category: string | null,
  subcategory: string | null,
  siteMode: string | null,
): number {
  if (!name?.trim()) return 0;
  if (!category) return 1;
  if (!subcategory?.trim()) return 2;
  if (!siteMode) return 3;
  return 4;
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="font-brand text-3xl sm:text-4xl">{title}</h2>
      {children}
    </div>
  );
}

function Choice({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 text-left",
        active ? "border-[#F97316] ring-2 ring-[#FDBA74]" : "border-[#2A2233]/10",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[#6B6275]">{desc}</p>
    </button>
  );
}
