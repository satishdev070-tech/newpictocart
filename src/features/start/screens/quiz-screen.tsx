"use client";

import { useState, type ReactNode } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { OnbCard, OnbEyebrow, onbButton, onbChip, onbField, onbHint } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { INDUSTRIES, industryShort, type IndustrySlug } from "@/features/stores/industries";
import { subcategoriesFor } from "@/features/stores/subcategories";
import { startCopy } from "../copy";
import { draftCategories, draftStoreName, draftSubcategories, type StartDraft } from "../draft/schema";
import {
  MAX_STORE_CATEGORIES,
  MAX_STORE_SUBCATEGORIES,
  storeFactsComplete,
  subcategoryOwner,
  type StoreFacts,
} from "../draft/apply-facts";

const FEATURED: IndustrySlug[] = ["fashion", "jewellery", "home-decor", "grocery", "beauty", "handicrafts"];
/** name → categories (≤3) → product types (≤8, grouped by category + custom) → city. */
const STEPS = 4;
const CITY_STEP = 3;

/**
 * Online-store quiz. Site mode is decided at /start/build, so there is no "What should we build?".
 * Every answer goes through `onSave(facts, done)` → `applyStoreFacts` (same as Tara's confirm).
 */
export function QuizScreen({
  draft,
  onBack,
  onSave,
}: {
  draft: StartDraft;
  onBack: () => void;
  onSave: (facts: StoreFacts, done: boolean) => void;
}) {
  const c = startCopy(draft.locale);
  const [name, setName] = useState(() => draftStoreName(draft));
  const [city, setCity] = useState(() => draft.business.city || draft.voice.facts.city || "");
  const [categories, setCategories] = useState<IndustrySlug[]>(() => draftCategories(draft));
  const [subs, setSubs] = useState<string[]>(() => draftSubcategories(draft));
  const [step, setStep] = useState(() => firstOpenStep(draftStoreName(draft), draftCategories(draft), draftSubcategories(draft)));
  const [more, setMore] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [subQueryRaw, setSubQueryRaw] = useState("");

  function facts(patch: Partial<StoreFacts> = {}): StoreFacts {
    return {
      name: (patch.name ?? name).trim() || null,
      categories: patch.categories ?? categories,
      subcategories: patch.subcategories ?? subs,
      city: (patch.city ?? city).trim(),
    };
  }

  function toggleCategory(slug: IndustrySlug) {
    let next: IndustrySlug[];
    let nextSubs = subs;
    if (categories.includes(slug)) {
      next = categories.filter((s) => s !== slug);
      // Drop product types only that category owned; customs stay.
      nextSubs = subs.filter((s) => subcategoryOwner(next, s) || !subcategoryOwner([slug], s));
    } else {
      if (categories.length >= MAX_STORE_CATEGORIES) return;
      next = [...categories, slug];
    }
    setCategories(next);
    setSubs(nextSubs);
    onSave(facts({ categories: next, subcategories: nextSubs }), false);
  }

  function setSubsAndSave(next: string[]) {
    setSubs(next);
    onSave(facts({ subcategories: next }), false);
  }

  function toggleSub(slug: string) {
    if (subs.includes(slug)) setSubsAndSave(subs.filter((s) => s !== slug));
    else if (subs.length < MAX_STORE_SUBCATEGORIES) setSubsAndSave([...subs, slug]);
  }

  function addCustomSub() {
    const label = subQueryRaw.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!label) return;
    const asSlug = label.toLowerCase().replace(/\s+/g, "-");
    const known = categories
      .flatMap((cat) => subcategoriesFor(cat))
      .find((s) => s.slug === asSlug || s.label.toLowerCase() === label.toLowerCase());
    const token = known?.slug ?? label;
    if (!subs.some((s) => s.toLowerCase() === token.toLowerCase()) && subs.length < MAX_STORE_SUBCATEGORIES) {
      setSubsAndSave([...subs, token]);
    }
    setSubQueryRaw("");
  }

  function finish(cityValue = city) {
    const f = facts({ city: cityValue });
    onSave(f, storeFactsComplete(f));
  }

  function next() {
    if (step < STEPS - 1) {
      onSave(facts(), false);
      setStep((s) => s + 1);
      return;
    }
    finish();
  }

  const customs = subs.filter((s) => !subcategoryOwner(categories, s));
  const canNext =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && categories.length > 0) ||
    (step === 2 && subs.length > 0) ||
    step >= CITY_STEP;

  // Category chips: featured (or all) + always the selected ones; search spans everything.
  const q = categoryQuery.trim().toLowerCase();
  const pool = more ? INDUSTRIES : INDUSTRIES.filter((ind) => FEATURED.includes(ind.slug) || categories.includes(ind.slug));
  const categoryChips = q
    ? INDUSTRIES.filter((ind) => ind.name.toLowerCase().includes(q) || ind.short.toLowerCase().includes(q) || ind.slug.includes(q))
    : pool;
  const categoriesFull = categories.length >= MAX_STORE_CATEGORIES;

  // Product types grouped by selected category; search filters every group.
  const subQuery = subQueryRaw.trim().toLowerCase();
  const groups = categories.map((cat) => {
    const all = subcategoriesFor(cat);
    const matches = subQuery
      ? all.filter((s) => s.label.toLowerCase().includes(subQuery) || s.slug.includes(subQuery.replace(/\s+/g, "-")))
      : all;
    // Keep selected chips visible even when search filters them out.
    const visible = [...all.filter((s) => subs.includes(s.slug) && !matches.includes(s)), ...matches];
    return { cat, visible, matchCount: matches.length };
  });
  const anyMatch = groups.some((g) => g.matchCount > 0);
  const exact =
    subQuery &&
    (groups.some((g) => g.visible.some((s) => s.label.toLowerCase() === subQuery)) || customs.some((x) => x.toLowerCase() === subQuery));
  const subsFull = subs.length >= MAX_STORE_SUBCATEGORIES;
  const showAddCta = Boolean(subQuery) && !anyMatch && !exact;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-4 sm:pt-8">
      <OnbCard className="space-y-5 p-5 sm:p-7">
        <OnbEyebrow>{c.quiz.step(step + 1, STEPS)}</OnbEyebrow>
        {step === 0 ? (
          <Question title={c.quiz.nameTitle} htmlFor="quiz-name">
            <input
              id="quiz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canNext) next();
              }}
              placeholder={c.quiz.nameHint}
              maxLength={120}
              className={onbField}
              autoFocus
            />
          </Question>
        ) : null}

        {step === 1 ? (
          <Question title={c.quiz.categoryTitle} hint={c.quiz.categoryHint(categories.length, MAX_STORE_CATEGORIES)}>
            <SearchField value={categoryQuery} onChange={setCategoryQuery} placeholder={c.quiz.categorySearch} />
            <div className="flex flex-wrap gap-2">
              {categoryChips.map((ind) => {
                const active = categories.includes(ind.slug);
                const disabled = !active && categoriesFull;
                return (
                  <button
                    key={ind.slug}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => toggleCategory(ind.slug)}
                    className={onbChip(active, "disabled:cursor-not-allowed disabled:opacity-40")}
                  >
                    {active ? <Check aria-hidden className="size-3.5 text-mk-accent" strokeWidth={3} /> : null}
                    {ind.short}
                  </button>
                );
              })}
            </div>
            {!q ? (
              <button type="button" onClick={() => setMore((v) => !v)} className={cn(onbButton.link, "text-sm")}>
                {more ? c.quiz.less : c.quiz.more}
              </button>
            ) : null}
          </Question>
        ) : null}

        {step === 2 ? (
          <Question title={c.quiz.subcategoryTitle} hint={c.quiz.subcategoryHint(subs.length, MAX_STORE_SUBCATEGORIES)}>
            <div className="flex gap-2">
              <SearchField
                value={subQueryRaw}
                onChange={setSubQueryRaw}
                placeholder={c.quiz.customSubHint}
                onEnter={addCustomSub}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={addCustomSub}
                disabled={!subQueryRaw.trim() || subsFull}
                className={cn(showAddCta ? onbButton.primary : onbButton.secondary, "shrink-0 px-5")}
              >
                <Plus aria-hidden className="size-4" />
                {c.quiz.customSubAdd}
              </button>
            </div>
            {showAddCta ? <p className="text-sm text-mk-muted">{c.quiz.customSubNoMatch(subQueryRaw.trim())}</p> : null}
            <div className="space-y-4">
              {groups.map(({ cat, visible }) =>
                visible.length ? (
                  <div key={cat} className="space-y-2">
                    {categories.length > 1 ? (
                      <p className="font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-dim">{industryShort(cat)}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {visible.map((sub) => {
                        const active = subs.includes(sub.slug);
                        return (
                          <button
                            key={`${cat}-${sub.slug}`}
                            type="button"
                            aria-pressed={active}
                            disabled={!active && subsFull}
                            onClick={() => toggleSub(sub.slug)}
                            className={onbChip(active, "disabled:cursor-not-allowed disabled:opacity-40")}
                          >
                            {active ? <Check aria-hidden className="size-3.5 text-mk-accent" strokeWidth={3} /> : null}
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null,
              )}
              {customs.length ? (
                <div className="flex flex-wrap gap-2">
                  {customs.map((label) => (
                    <button
                      key={`custom-${label}`}
                      type="button"
                      onClick={() => setSubsAndSave(subs.filter((s) => s !== label))}
                      className={onbChip(true)}
                      aria-label={`${c.quiz.customSubRemove} ${label}`}
                    >
                      {label}
                      <X aria-hidden className="size-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Question>
        ) : null}

        {step === CITY_STEP ? (
          <Question title={c.quiz.cityTitle} htmlFor="quiz-city">
            <input
              id="quiz-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") next();
              }}
              placeholder={c.quiz.cityHint}
              maxLength={80}
              className={onbField}
              autoFocus
            />
          </Question>
        ) : null}
      </OnbCard>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <button
            type="button"
            onClick={() => {
              if (step > 0) {
                onSave(facts(), false);
                setStep((s) => s - 1);
                return;
              }
              onBack();
            }}
            className={onbButton.secondary}
          >
            ← {c.back}
          </button>
          {step === CITY_STEP ? (
            <button
              type="button"
              onClick={() => {
                setCity("");
                finish("");
              }}
              className={onbButton.ghost}
            >
              {c.quiz.skip}
            </button>
          ) : null}
        </div>
        <button type="button" disabled={!canNext} onClick={next} className={onbButton.primary}>
          {step === STEPS - 1 ? c.quiz.finish : c.quiz.next}
        </button>
      </div>
    </section>
  );
}

function firstOpenStep(name: string, categories: readonly string[], subs: readonly string[]): number {
  if (name.trim().length < 2) return 0;
  if (!categories.length) return 1;
  if (!subs.length) return 2;
  return CITY_STEP;
}

function SearchField({
  value,
  onChange,
  placeholder,
  onEnter,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mk-dim" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(onbField, "pl-10")}
        autoFocus
      />
    </div>
  );
}

function Question({ title, hint, htmlFor, children }: { title: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-brand text-2xl font-semibold leading-tight tracking-[-0.01em] text-mk-text sm:text-3xl">
          {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : title}
        </h2>
        {hint ? <p className={onbHint}>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
