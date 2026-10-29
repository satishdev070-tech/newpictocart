"use client";

import { useState, type ReactNode } from "react";
import { Globe2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/cn";
import { INDUSTRIES, isIndustry, type IndustrySlug } from "@/features/stores/industries";
import { isSubcategory, subcategoriesFor } from "@/features/stores/subcategories";
import type { SiteMode } from "@/features/stores/site-mode";
import { type VoiceFacts } from "@/features/onboarding/voice/facts";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { voiceFactsComplete } from "../flow";

const FEATURED: IndustrySlug[] = ["fashion", "jewellery", "home-decor", "grocery", "beauty", "handicrafts"];
/** name → category → subcategory → siteMode → city (tagline auto/null) */
const STEPS = 5;
const SUB_EXTRAS_PREFIX = "sub:";

export function QuizScreen({
  draft,
  onBack,
  onSave,
}: {
  draft: StartDraft;
  onBack: () => void;
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
  const [categoryQuery, setCategoryQuery] = useState("");
  const [name, setName] = useState(draft.voice.facts.name ?? draft.business.name);
  const [city, setCity] = useState(draft.voice.facts.city ?? draft.business.city);
  const [customSub, setCustomSub] = useState("");
  const facts = draft.voice.facts;
  const category = facts.category && isIndustry(facts.category) ? facts.category : null;
  const subs = category ? subcategoriesFor(category) : [];
  const { selected: selectedSubs, customs: customSubs } = parseSubSelection(
    category,
    facts.subcategory,
    facts.productsServices,
  );

  function current(patch: Partial<VoiceFacts> = {}): VoiceFacts {
    return {
      name: (patch.name ?? name).trim() || null,
      category: patch.category !== undefined ? patch.category : category,
      subcategory: patch.subcategory !== undefined ? patch.subcategory : facts.subcategory,
      productsServices:
        patch.productsServices !== undefined ? patch.productsServices : facts.productsServices,
      siteMode: patch.siteMode !== undefined ? patch.siteMode : facts.siteMode,
      city: (patch.city ?? city).trim() || null,
      // Tagline is auto/null — quiz no longer asks for it.
      tagline: patch.tagline !== undefined ? patch.tagline : null,
    };
  }

  function persistSubs(nextSelected: string[], nextCustoms: string[]) {
    // Schema expects a single primary subcategory string; extras/customs ride in productsServices.
    const primary = nextSelected[0] ?? nextCustoms[0]?.trim() ?? null;
    const extras = nextSelected.slice(1);
    const remainingCustoms = nextSelected.length > 0 ? nextCustoms : nextCustoms.slice(1);
    const productsServices = encodeSubExtras(extras, remainingCustoms);
    onSave(current({ subcategory: primary, productsServices }), false);
  }

  function chooseCategory(slug: IndustrySlug) {
    const nextFacts = current({
      category: slug,
      subcategory: category === slug ? facts.subcategory : null,
      productsServices: category === slug ? facts.productsServices : null,
    });
    onSave(nextFacts, false);
  }

  function toggleSubcategory(slug: string) {
    const next = selectedSubs.includes(slug)
      ? selectedSubs.filter((s) => s !== slug)
      : [...selectedSubs, slug];
    persistSubs(next, customSubs);
  }

  function addCustomSub() {
    const label = customSub.trim();
    if (!label) return;
    if (category) {
      const match = subs.find(
        (s) =>
          s.slug === label.toLowerCase().replace(/\s+/g, "-") ||
          s.label.toLowerCase() === label.toLowerCase(),
      );
      if (match) {
        const next = selectedSubs.includes(match.slug) ? selectedSubs : [...selectedSubs, match.slug];
        persistSubs(next, customSubs);
        setCustomSub("");
        return;
      }
    }
    const exists = customSubs.some((x) => x.toLowerCase() === label.toLowerCase());
    if (!exists) persistSubs(selectedSubs, [...customSubs, label]);
    setCustomSub("");
  }

  function removeCustomSub(label: string) {
    persistSubs(
      selectedSubs,
      customSubs.filter((x) => x !== label),
    );
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
    (step === 2 && (selectedSubs.length > 0 || customSubs.length > 0)) ||
    (step === 3 && Boolean(facts.siteMode)) ||
    step >= 4;

  const q = categoryQuery.trim().toLowerCase();
  const pool = more
    ? INDUSTRIES
    : INDUSTRIES.filter((ind) => FEATURED.includes(ind.slug) || ind.slug === category);
  const categories = q
    ? INDUSTRIES.filter(
        (ind) =>
          ind.name.toLowerCase().includes(q) ||
          ind.short.toLowerCase().includes(q) ||
          ind.slug.includes(q),
      )
    : pool;

  return (
    <section className="mx-auto flex min-h-[min(70vh,36rem)] w-full max-w-2xl flex-col justify-center gap-8 px-1">
      <div className="mx-auto w-full max-w-xl space-y-5">
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
            <input
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder={c.quiz.categorySearch}
              className="w-full rounded-xl border border-[#2A2233]/10 bg-white px-3 py-2.5 text-sm"
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {categories.map((ind) => (
                <button
                  key={ind.slug}
                  type="button"
                  onClick={() => chooseCategory(ind.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    category === ind.slug
                      ? "border-[#F97316] bg-[#FFF7ED] font-semibold text-[#C2410C]"
                      : "border-[#2A2233]/10 bg-white",
                  )}
                >
                  {ind.short}
                </button>
              ))}
            </div>
            {!q ? (
              <button
                type="button"
                onClick={() => setMore((v) => !v)}
                className="text-sm text-[#C2410C] underline"
              >
                {more ? c.quiz.less : c.quiz.more}
              </button>
            ) : null}
          </Question>
        ) : null}
        {step === 2 ? (
          <Question title={c.quiz.subcategoryTitle}>
            <div className="flex flex-wrap gap-1.5">
              {subs.map((sub) => {
                const active = selectedSubs.includes(sub.slug);
                return (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => toggleSubcategory(sub.slug)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      active
                        ? "border-[#F97316] bg-[#FFF7ED] font-semibold text-[#C2410C]"
                        : "border-[#2A2233]/10 bg-white",
                    )}
                  >
                    {sub.label}
                  </button>
                );
              })}
              {customSubs.map((label) => (
                <button
                  key={`custom-${label}`}
                  type="button"
                  onClick={() => removeCustomSub(label)}
                  className="rounded-full border border-[#F97316] bg-[#FFF7ED] px-3 py-1.5 text-sm font-semibold text-[#C2410C]"
                  title={c.quiz.customSubRemove}
                >
                  {label} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customSub}
                onChange={(e) => setCustomSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSub();
                  }
                }}
                placeholder={c.quiz.customSubHint}
                className="min-w-0 flex-1 rounded-xl border border-[#2A2233]/10 bg-white px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={addCustomSub}
                disabled={!customSub.trim()}
                className="shrink-0 rounded-xl border border-[#2A2233]/10 bg-white px-3 py-2.5 text-sm font-medium text-[#C2410C] disabled:opacity-40"
              >
                {c.quiz.customSubAdd}
              </button>
            </div>
          </Question>
        ) : null}
        {step === 3 ? (
          <Question title={c.quiz.siteTitle}>
            <div className="grid gap-3">
              <Choice
                active={facts.siteMode === "ecommerce"}
                title={c.quiz.storeTitle}
                desc={c.quiz.storeDesc}
                icon={<ShoppingBag className="size-6 shrink-0 text-[#C2410C]" aria-hidden />}
                onClick={() => chooseSite("ecommerce")}
              />
              <Choice
                active={facts.siteMode === "informative"}
                title={c.quiz.siteInfoTitle}
                desc={c.quiz.siteInfoDesc}
                icon={<Globe2 className="size-6 shrink-0 text-[#C2410C]" aria-hidden />}
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
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step > 0) {
                setStep((s) => s - 1);
                return;
              }
              onBack();
            }}
            className="rounded-full border border-white/90 bg-white/60 px-5 py-3 text-sm font-medium text-[#5E5568]"
          >
            ← {c.back}
          </button>
          {step === 4 ? (
            <button
              type="button"
              onClick={() => {
                setCity("");
                const cleared = current({ city: "" });
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
              }}
              className="text-sm text-[#6B6275] underline"
            >
              {c.quiz.skip}
            </button>
          ) : null}
        </div>
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

/** Primary slug in subcategory; extras/custom in productsServices as `sub:slug2,Custom`. */
function encodeSubExtras(extraSlugs: string[], customs: string[]): string | null {
  const parts = [...extraSlugs, ...customs.map((c) => c.trim()).filter(Boolean)];
  if (!parts.length) return null;
  return `${SUB_EXTRAS_PREFIX}${parts.join(",")}`;
}

function parseSubSelection(
  category: IndustrySlug | null,
  subcategory: string | null,
  productsServices: string | null,
): { selected: string[]; customs: string[] } {
  const selected: string[] = [];
  const customs: string[] = [];
  const primary = subcategory?.trim();
  if (primary) {
    if (!category || isSubcategory(category, primary)) selected.push(primary);
    else customs.push(primary);
  }
  const raw = productsServices?.trim() ?? "";
  if (raw.startsWith(SUB_EXTRAS_PREFIX)) {
    for (const part of raw.slice(SUB_EXTRAS_PREFIX.length).split(",")) {
      const token = part.trim();
      if (!token) continue;
      if (category && isSubcategory(category, token)) {
        if (!selected.includes(token)) selected.push(token);
      } else if (!customs.some((c) => c.toLowerCase() === token.toLowerCase())) {
        customs.push(token);
      }
    }
  }
  return { selected, customs };
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-3xl border border-[#2A2233]/08 bg-white/70 p-5 shadow-sm sm:p-6">
      <h2 className="font-brand text-3xl sm:text-4xl">{title}</h2>
      {children}
    </div>
  );
}

function Choice({
  active,
  title,
  desc,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-4 rounded-2xl border bg-white p-4 text-left",
        active ? "border-[#F97316] ring-2 ring-[#FDBA74]" : "border-[#2A2233]/10",
      )}
    >
      <span className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-[#FFF7ED]">{icon}</span>
      <span className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-[#6B6275]">{desc}</p>
      </span>
    </button>
  );
}
