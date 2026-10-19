"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { SITE_MODE_LABELS, type SiteMode } from "@/features/stores/site-mode";
import { saveSiteModeAction } from "../actions";

/** Small, explicit mode switcher kept in General settings so sellers can reverse the choice. */
export function SiteModeForm({ value }: { value: SiteMode }) {
  const [state, action] = useActionState(saveSiteModeAction, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <fieldset>
        <legend className="sr-only">Website type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["informative", "ecommerce"] as const).map((mode) => {
            const option = SITE_MODE_LABELS[mode];
            return (
              <label key={mode} className="cursor-pointer rounded-lg border border-border bg-surface p-4 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
                <input type="radio" name="siteMode" value={mode} defaultChecked={value === mode} className="sr-only" />
                <span className="block text-small font-semibold">{option.title}</span>
                <span className="mt-1 block text-caption leading-relaxed text-muted">{option.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-caption text-muted">Switching never deletes your products, orders, payment settings or customer data. Informative websites simply hide shopping features until you switch back.</p>
      <SubmitButton>Save website type</SubmitButton>
    </form>
  );
}
