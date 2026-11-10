"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { informativeSitesEnabled } from "@/features/stores/informative-flag";
import { SITE_MODE_LABELS, type SiteMode } from "@/features/stores/site-mode";
import { saveSiteModeAction } from "../actions";

/** Small, explicit mode switcher kept in General settings so sellers can reverse the choice. */
export function SiteModeForm({ value }: { value: SiteMode }) {
  const [state, action] = useActionState(saveSiteModeAction, null);
  const informativeEnabled = informativeSitesEnabled();
  const legacyInformative = !informativeEnabled && value === "informative";

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {legacyInformative ? (
        <p className="text-caption text-muted">
          This store still uses an informational website. That option is temporarily unavailable for new
          sites; existing informative stores keep working. Choose Online store below if you want a shop.
        </p>
      ) : null}
      <fieldset>
        <legend className="sr-only">Website type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="cursor-pointer rounded-lg border border-border bg-surface p-4 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
            <input
              type="radio"
              name="siteMode"
              value="ecommerce"
              defaultChecked={value === "ecommerce" || legacyInformative}
              className="sr-only"
            />
            <span className="block text-small font-semibold">{SITE_MODE_LABELS.ecommerce.title}</span>
            <span className="mt-1 block text-caption leading-relaxed text-muted">{SITE_MODE_LABELS.ecommerce.description}</span>
          </label>
          {informativeEnabled ? (
            <label className="cursor-pointer rounded-lg border border-border bg-surface p-4 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
              <input type="radio" name="siteMode" value="informative" defaultChecked={value === "informative"} className="sr-only" />
              <span className="block text-small font-semibold">{SITE_MODE_LABELS.informative.title}</span>
              <span className="mt-1 block text-caption leading-relaxed text-muted">{SITE_MODE_LABELS.informative.description}</span>
            </label>
          ) : (
            <div
              aria-disabled
              className="rounded-lg border border-dashed border-border bg-surface-secondary/40 p-4 opacity-70"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="block text-small font-semibold">{SITE_MODE_LABELS.informative.title}</span>
                <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-caption font-medium text-muted">Coming soon</span>
              </span>
              <span className="mt-1 block text-caption leading-relaxed text-muted">{SITE_MODE_LABELS.informative.description}</span>
            </div>
          )}
        </div>
      </fieldset>
      <p className="text-caption text-muted">
        Switching never deletes your products, orders, payment settings or customer data. Informative
        websites simply hide shopping features until you switch back.
      </p>
      <SubmitButton>Save website type</SubmitButton>
    </form>
  );
}
