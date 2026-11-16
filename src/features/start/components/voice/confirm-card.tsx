"use client";

import { X } from "lucide-react";
import { onbButton, onbChip, onbField, onbLabel } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { INDUSTRIES, type IndustrySlug } from "@/features/stores/industries";
import { isSubcategory, subcategoryLabel } from "@/features/stores/subcategories";
import type { VoiceFacts } from "@/features/onboarding/voice/facts";
import type { VoiceUiCopy } from "./voice-copy";

export function industryName(slug: IndustrySlug): string {
  return INDUSTRIES.find((i) => i.slug === slug)?.name ?? slug;
}

/** Known slug → its label (within the selected categories); custom label → as said. */
export function productTypeLabel(categories: readonly IndustrySlug[], token: string): string {
  const owner = categories.find((c) => isSubcategory(c, token));
  return (owner ? subcategoryLabel(owner, token) : null) ?? token;
}

/** Tara's summary card: editable name + city, removable chips, confirm / keep talking. */
export function ConfirmCard({
  t,
  facts,
  onChange,
  onConfirm,
  onKeepTalking,
}: {
  t: VoiceUiCopy;
  facts: VoiceFacts;
  onChange: (patch: Partial<VoiceFacts>) => void;
  onConfirm: () => void;
  onKeepTalking: () => void;
}) {
  const name = facts.name ?? "";
  const canConfirm = name.trim().length >= 2 && facts.categories.length > 0 && facts.subcategories.length > 0;

  return (
    <section
      aria-label={t.confirmTitle}
      className="rounded-[var(--r-md)] border border-mk-accent/60 bg-mk-accent-tint p-4 shadow-[0_0_0_1px_var(--mk-accent)] sm:p-5"
    >
      <p className="text-base font-semibold text-mk-text">{t.confirmTitle}</p>
      <p className="mb-4 text-sm text-mk-muted">{t.confirmHint}</p>

      <label htmlFor="tara-confirm-name" className={onbLabel}>
        {t.storeName}
      </label>
      <input
        id="tara-confirm-name"
        value={name}
        maxLength={120}
        onChange={(e) => onChange({ name: e.target.value })}
        className={cn(onbField, "min-h-11")}
        aria-invalid={name.trim().length < 2}
      />

      <p className={cn(onbLabel, "mt-4")}>{t.categories}</p>
      <div className="flex flex-wrap gap-2">
        {facts.categories.map((c) => (
          <span key={c} className={onbChip(true, "pr-2")}>
            {industryName(c)}
            {facts.categories.length > 1 ? (
              <button
                type="button"
                aria-label={t.remove(industryName(c))}
                onClick={() => onChange({ categories: facts.categories.filter((x) => x !== c) })}
                className="grid size-6 place-items-center rounded-full text-mk-muted hover:bg-white/10 hover:text-mk-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </span>
        ))}
      </div>

      <p className={cn(onbLabel, "mt-4")}>{t.productTypes}</p>
      <div className="flex flex-wrap gap-2">
        {facts.subcategories.map((s) => {
          const label = productTypeLabel(facts.categories, s);
          return (
            <span key={s} className={onbChip(true, "pr-2")}>
              {label}
              <button
                type="button"
                aria-label={t.remove(label)}
                onClick={() => onChange({ subcategories: facts.subcategories.filter((x) => x !== s) })}
                className="grid size-6 place-items-center rounded-full text-mk-muted hover:bg-white/10 hover:text-mk-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          );
        })}
      </div>

      <label htmlFor="tara-confirm-city" className={cn(onbLabel, "mt-4")}>
        {t.city}
      </label>
      <input
        id="tara-confirm-city"
        value={facts.city ?? ""}
        maxLength={80}
        placeholder={t.cityPlaceholder}
        onChange={(e) => onChange({ city: e.target.value })}
        className={cn(onbField, "min-h-11")}
      />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onConfirm} disabled={!canConfirm} className={cn(onbButton.primary, "sm:flex-1")}>
          {t.looksGood}
        </button>
        <button type="button" onClick={onKeepTalking} className={onbButton.secondary}>
          {t.keepTalking}
        </button>
      </div>
    </section>
  );
}
