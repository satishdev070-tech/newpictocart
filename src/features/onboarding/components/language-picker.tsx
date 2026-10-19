"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { SARVAM_LOCALES, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { saveOnboardingLocaleAction } from "../voice/actions";
import { onboardingHref } from "../steps";

export function LanguagePicker({
  selected,
  plan,
  theme,
}: {
  selected: SarvamLocaleCode | null;
  plan: string | null;
  theme: string | null;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<SarvamLocaleCode | null>(selected);
  const [state, action] = useActionState(saveOnboardingLocaleAction, null as Awaited<ReturnType<typeof saveOnboardingLocaleAction>> | null);
  const [, startTransition] = useTransition();
  const errors = fieldErrors(state);

  useEffect(() => {
    if (state?.ok && state.data.locale) {
      startTransition(() => {
        router.push(onboardingHref("method", null, { plan, theme, locale: state.data.locale }));
        router.refresh();
      });
    }
  }, [state, plan, theme, router]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale ?? ""} />
      <FormMessage state={state} />
      {errors.locale ? <p className="text-sm text-danger">{errors.locale[0]}</p> : null}
      <ul className="grid max-h-[24rem] gap-2 overflow-y-auto sm:grid-cols-2">
        {SARVAM_LOCALES.map((l) => {
          const active = locale === l.code;
          return (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => setLocale(l.code)}
                className={cn(
                  "flex w-full flex-col items-start rounded-brand-md border px-4 py-3 text-left transition",
                  active ? "border-brand bg-brand-soft/40 ring-2 ring-brand" : "border-border bg-white hover:border-brand/40",
                )}
                aria-pressed={active}
              >
                <span className="font-semibold text-brand-ink">{l.nativeLabel}</span>
                <span className="text-xs text-muted">{l.englishName}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <SubmitButton size="lg" disabled={!locale} className="w-full">
        Continue
      </SubmitButton>
    </form>
  );
}
