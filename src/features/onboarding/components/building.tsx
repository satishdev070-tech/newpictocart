"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { seedReadyStoreAction } from "../actions";

/** Auto-starts the ready-store seed; shows progress and a manual retry / skip. */
export function BuildingPanel({
  storeId,
  locale,
  plan,
  theme,
}: {
  storeId: string;
  locale: string | null;
  plan: string | null;
  theme: string | null;
}) {
  const [state, action] = useActionState(seedReadyStoreAction, null);
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Defer so the form is mounted.
    const t = window.setTimeout(() => formRef.current?.requestSubmit(), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-brand-md bg-brand-canvas p-4 text-sm text-brand-ink">
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
        <p>Tara is setting up categories, products, navigation, homepage copy, blogs and a curated theme…</p>
      </div>
      <FormMessage state={state} />
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="store" value={storeId} />
        {locale ? <input type="hidden" name="locale" value={locale} /> : null}
        {plan ? <input type="hidden" name="plan" value={plan} /> : null}
        {theme ? <input type="hidden" name="theme" value={theme} /> : null}
        <div className="flex flex-wrap gap-3">
          <SubmitButton>Retry build</SubmitButton>
          <SubmitButton name="skip" value="1" variant="secondary">
            Skip to ready
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
