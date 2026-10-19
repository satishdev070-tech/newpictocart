"use client";

import Link from "next/link";
import { Mic, Keyboard } from "lucide-react";
import { buttonClass } from "@/features/marketing-site/components/ui";
import { onboardingHref } from "../steps";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";

export function MethodPicker({
  locale,
  plan,
  theme,
  voiceAvailable,
}: {
  locale: SarvamLocaleCode;
  plan: string | null;
  theme: string | null;
  voiceAvailable: boolean;
}) {
  const choice = { plan, theme, locale, method: "voice" as const };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href={voiceAvailable ? onboardingHref("voice", null, { ...choice, method: "voice" }) : onboardingHref("business", null, { ...choice, method: "form" })}
        className="flex flex-col rounded-brand-md border border-border p-5 transition hover:border-brand hover:ring-2 hover:ring-brand"
      >
        <Mic aria-hidden className="size-6 text-brand" />
        <span className="mt-3 font-semibold text-brand-ink">Talk with Tara</span>
        <span className="mt-1 text-sm text-muted">
          {voiceAvailable ? "Speak your business details in your language. We’ll fill the form for you." : "Voice isn’t configured yet — we’ll open the form instead."}
        </span>
        <span className={`mt-4 ${buttonClass("primary")} pointer-events-none self-start`}>Use voice</span>
      </Link>
      <Link
        href={onboardingHref("business", null, { ...choice, method: "form" })}
        className="flex flex-col rounded-brand-md border border-border p-5 transition hover:border-brand hover:ring-2 hover:ring-brand"
      >
        <Keyboard aria-hidden className="size-6 text-brand" />
        <span className="mt-3 font-semibold text-brand-ink">Fill a form</span>
        <span className="mt-1 text-sm text-muted">Type your business name, category and store address yourself.</span>
        <span className={`mt-4 ${buttonClass("secondary")} pointer-events-none self-start`}>Use form</span>
      </Link>
    </div>
  );
}
