"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { SARVAM_LOCALES, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { startCopy } from "../copy";
import { START_UI_LOCALES } from "../supported-locales";

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
    <section className="flex w-full max-w-5xl flex-col gap-8">
      <div className="text-center">
        <h1 className="font-brand text-4xl font-normal leading-tight text-balance sm:text-5xl md:text-6xl">
          {c.lang.headline}
        </h1>
        <p className="mt-3 text-lg text-[#5E5568] sm:text-xl">{c.lang.sub}</p>
      </div>
      <ul
        className="mx-auto grid w-full max-w-xl grid-cols-2 gap-3 md:gap-4"
        role="listbox"
        aria-label={c.lang.sub}
      >
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
                className={cn(
                  "flex min-h-28 w-full flex-col justify-between rounded-[24px] border px-4 py-4 text-left backdrop-blur-md transition sm:min-h-32 sm:px-5 sm:py-5",
                  active
                    ? "border-[#F97316] bg-white shadow-[0_16px_36px_-16px_rgba(249,115,22,0.55)] ring-2 ring-[#F97316]/30"
                    : "border-white/90 bg-white/55 hover:bg-white/80",
                )}
              >
                <span className="text-2xl font-medium leading-snug sm:text-3xl">{l.nativeLabel}</span>
                <span className="mt-3 flex items-center justify-between gap-2 text-sm text-[#6B6275]">
                  {l.englishName}
                  {active ? (
                    <span className="grid size-6 place-items-center rounded-full bg-[#F97316] text-xs text-white" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-8 py-3.5 text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)]"
        >
          {c.lang.continue(selected?.englishName ?? "English")}
        </button>
      </div>
    </section>
  );
}
