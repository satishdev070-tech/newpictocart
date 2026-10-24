"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Globe, ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { SITE_MODE_LABELS, type SiteMode } from "@/features/stores/site-mode";
import { saveOnboardingSiteModeAction } from "../voice/actions";
import { onboardingHref } from "../steps";

const OPTIONS: { mode: SiteMode; icon: typeof Globe; points: string[] }[] = [
  { mode: "informative", icon: Globe, points: ["About, services and gallery pages", "Contact form and WhatsApp", "No cart or checkout"] },
  { mode: "ecommerce", icon: ShoppingBag, points: ["Products, cart and checkout", "UPI, cards and cash on delivery", "Orders, stock and GST invoices"] },
];

/**
 * First onboarding question ("What are you building?"). The answer is saved on the account and
 * pre-selects the site mode in the form and voice paths, so the existing store setup runs as before.
 */
export function SiteTypePicker({ selected, plan, theme }: { selected: SiteMode | null; plan: string | null; theme: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<SiteMode | null>(selected);
  const [state, action] = useActionState(saveOnboardingSiteModeAction, null as Awaited<ReturnType<typeof saveOnboardingSiteModeAction>> | null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      startTransition(() => {
        router.push(onboardingHref("language", null, { plan, theme }));
        router.refresh();
      });
    }
  }, [state, plan, theme, router]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="siteMode" value={mode ?? ""} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="What are you building?">
        {OPTIONS.map(({ mode: m, icon: Icon, points }) => {
          const active = mode === m;
          const label = SITE_MODE_LABELS[m];
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m)}
              className={cn(
                "group relative flex h-full flex-col items-start gap-3 rounded-brand-md border bg-white p-5 text-left transition",
                active ? "border-brand ring-2 ring-brand" : "border-border hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md",
              )}
            >
              <span className={cn("grid size-11 place-items-center rounded-xl", active ? "bg-brand text-white" : "bg-brand-soft/60 text-brand")}>
                <Icon aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-semibold text-brand-ink">{m === "ecommerce" ? "E-commerce store" : label.title}</span>
                <span className="mt-1 block text-sm text-muted">{label.description}</span>
              </span>
              <ul className="space-y-1 text-xs text-muted">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 text-success" /> {p}
                  </li>
                ))}
              </ul>
              {active ? <Check aria-hidden className="absolute right-4 top-4 size-5 text-brand" /> : null}
            </button>
          );
        })}
      </div>
      <SubmitButton disabled={!mode} className="w-full">
        Continue
      </SubmitButton>
      <p className="text-center text-xs text-muted">You can change this later in Settings → General → Website type.</p>
    </form>
  );
}
