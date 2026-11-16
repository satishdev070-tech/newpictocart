"use client";

import { Check } from "lucide-react";
import { OnbHeading, OnbSub, onbButton, onbChoice } from "@/components/onboarding-ui";
import { getSarvamLocale, type SarvamLocale, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { startCopy } from "../copy";
import { START_UI_LOCALES } from "../supported-locales";

/** The 10 onboarding languages, in START_UI_LOCALES order. */
const UI_LOCALES: readonly SarvamLocale[] = START_UI_LOCALES.map((code) => getSarvamLocale(code)).filter((l): l is SarvamLocale => Boolean(l));

/** Step 1 of every journey: 10 language cards (2 columns on phones, 5 on desktop). Continue → /start/build (or /start/path when that step is off). */
export function LangScreen({
  locale,
  onSelect,
  onContinue,
}: {
  locale: SarvamLocaleCode;
  onSelect: (code: SarvamLocaleCode) => void;
  onContinue: () => void;
}) {
  const c = startCopy(locale);
  const selected = UI_LOCALES.find((l) => l.code === locale) ?? UI_LOCALES[0];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 pt-6 sm:pt-12">
      <div className="space-y-3 text-center">
        <OnbHeading>{c.lang.headline}</OnbHeading>
        <OnbSub>{c.lang.sub}</OnbSub>
      </div>
      <ul className="grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" role="listbox" aria-label={c.lang.sub}>
        {UI_LOCALES.map((l) => {
          const active = locale === l.code;
          return (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                aria-label={`${l.englishName} (${l.nativeLabel})`}
                onClick={() => onSelect(l.code)}
                lang={l.code.slice(0, 2)}
                className={onbChoice(active, "flex h-full min-h-28 flex-col justify-between sm:min-h-32")}
              >
                <span className="font-brand text-2xl font-semibold leading-snug text-mk-text sm:text-[1.75rem]">{l.nativeLabel}</span>
                <span lang="en" className="mt-3 flex items-center justify-between gap-2 text-sm text-mk-muted">
                  {l.englishName}
                  {active ? (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-mk-accent text-mk-accent-ink" aria-hidden>
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onContinue} className={`${onbButton.primary} w-full sm:w-auto`}>
          {c.lang.continue(selected?.englishName ?? "English")}
        </button>
      </div>
    </section>
  );
}
