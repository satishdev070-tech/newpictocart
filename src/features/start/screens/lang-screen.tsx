"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { OnbHeading, OnbSub, onbButton, onbChoice } from "@/components/onboarding-ui";
import { SARVAM_LOCALES, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { startCopy } from "../copy";
import { START_UI_LOCALES } from "../supported-locales";

/** Step 1 of every journey: English | हिन्दी. Continue → /start/build (or /start/path when that step is off). */
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
  const primaryLocales = useMemo(
    () => SARVAM_LOCALES.filter((l) => (START_UI_LOCALES as readonly string[]).includes(l.code)),
    [],
  );
  const selected = SARVAM_LOCALES.find((l) => l.code === locale) ?? primaryLocales[0];

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 pt-6 sm:pt-12">
      <div className="space-y-3 text-center">
        <OnbHeading>{c.lang.headline}</OnbHeading>
        <OnbSub>{c.lang.sub}</OnbSub>
      </div>
      <ul className="grid w-full grid-cols-2 gap-3 sm:gap-4" role="listbox" aria-label={c.lang.sub}>
        {primaryLocales.map((l) => {
          const active = locale === l.code;
          return (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                aria-label={`${l.englishName} (${l.nativeLabel})`}
                onClick={() => onSelect(l.code)}
                className={onbChoice(active, "flex min-h-28 flex-col justify-between sm:min-h-32")}
              >
                <span className="font-brand text-2xl font-semibold leading-snug text-mk-text sm:text-3xl">{l.nativeLabel}</span>
                <span className="mt-3 flex items-center justify-between gap-2 text-sm text-mk-muted">
                  {l.englishName}
                  {active ? (
                    <span className="grid size-6 place-items-center rounded-full bg-mk-accent text-mk-accent-ink" aria-hidden>
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
