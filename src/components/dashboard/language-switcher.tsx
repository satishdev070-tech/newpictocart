"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, localeCookie, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";

function saveLocale(l: Locale) {
  document.cookie = localeCookie(l);
}

/**
 * Seller panel language (segmented control). Writes the `pc_lang` cookie and re-renders the
 * server components in place; no database write. Shown in the account menu and in Settings.
 */
export function LanguageSwitcher({ current, label, className }: { current: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(current);
  const [pending, start] = useTransition();
  const choose = (l: Locale) => {
    if (l === chosen) return;
    setChosen(l);
    saveLocale(l);
    start(() => router.refresh());
  };
  return (
    <div role="radiogroup" aria-label={label} aria-busy={pending || undefined} className={cn("inline-flex rounded-md border border-border bg-surface-secondary p-0.5", pending && "opacity-70", className)}>
      {LOCALES.map((l) => {
        const on = chosen === l;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            lang={l}
            onClick={() => choose(l)}
            className={cn("flex-1 rounded-[5px] px-2.5 py-1 text-caption font-medium transition-colors", on ? "bg-surface text-accent shadow-xs" : "text-muted hover:text-foreground")}
          >
            {LOCALE_NAMES[l]}
          </button>
        );
      })}
    </div>
  );
}
