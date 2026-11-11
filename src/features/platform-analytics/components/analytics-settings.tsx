"use client";

import { useId, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { ActionForm } from "@/features/settings/ui/action-controls";
import { Badge, Card } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { saveAnalyticsSettingsAction } from "../actions";

function Switch({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        <p className="text-caption text-muted">{hint}</p>
      </div>
      <input id={id} type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <label
        htmlFor={id}
        aria-hidden
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-border-strong transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-xs after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
      />
    </div>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  return (
    <>
      {errors?.map((m) => (
        <p key={m} role="alert" className="text-caption text-error">
          {m}
        </p>
      ))}
    </>
  );
}

function LiveBadge({ live, children }: { live: boolean; children: ReactNode }) {
  return live ? <Badge tone="success">{children}</Badge> : <Badge>Off</Badge>;
}

export type AnalyticsSettingsValues = {
  ga4Id: string;
  ga4Enabled: boolean;
  firstParty: boolean;
  metaPixel: string;
  metaPixelEnabled: boolean;
};

/** Google Analytics (gtag) and Meta Pixel settings cards for Super Admin → Analytics. */
export function AnalyticsSettings({ values }: { values: AnalyticsSettingsValues }) {
  const gaId = useId();
  const pixelId = useId();
  const gaLive = values.ga4Enabled && !!values.ga4Id;
  const pixelLive = values.metaPixelEnabled && !!values.metaPixel;
  return (
    <>
      <Card title="Google Analytics (gtag)" description="The measurement ID is loaded on platform pages (website, seller sign-in, /start). Visitors are also counted first-party, so the report below works without the GA API.">
        <ActionForm action={saveAnalyticsSettingsAction} fields={{ group: "google" }} submitLabel="Save settings" success="Google Analytics settings saved." className="space-y-4">
          {(e) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={gaId} className="text-small font-medium">
                    Measurement ID
                  </label>
                  <input id={gaId} name="ga4_id" defaultValue={values.ga4Id} placeholder="G-XXXXXXXXXX" autoComplete="off" spellCheck={false} className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-small" />
                  <FieldErrors errors={e.ga4_id} />
                </div>
                <div className="space-y-3">
                  <Switch name="ga4_enabled" label="Enable Google Analytics" hint="Loads gtag.js on platform pages" defaultChecked={values.ga4Enabled} />
                  <Switch name="first_party" label="First-party visitor tracking" hint="Powers the report below (no cookies or IPs stored)" defaultChecked={values.firstParty} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
                  <ExternalLink aria-hidden /> Open Google Analytics
                </a>
                <LiveBadge live={gaLive}>Live · {values.ga4Id}</LiveBadge>
              </div>
            </>
          )}
        </ActionForm>
      </Card>

      <Card title="Meta Pixel" description="Paste a Pixel ID or the Meta base code. Only the numeric ID is stored. The official Meta script loads on platform pages and stays off merchant stores and admin pages.">
        <ActionForm action={saveAnalyticsSettingsAction} fields={{ group: "meta" }} submitLabel="Save settings" success="Meta Pixel settings saved." className="space-y-4">
          {(e) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={pixelId} className="text-small font-medium">
                    Pixel ID or base code
                  </label>
                  <textarea id={pixelId} name="meta_pixel" defaultValue={values.metaPixel} rows={4} placeholder="1234567890123456 or <!-- Meta Pixel Code --> …" spellCheck={false} className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-small" />
                  <FieldErrors errors={e.meta_pixel} />
                </div>
                <div className="space-y-3 md:self-end">
                  <Switch name="meta_pixel_enabled" label="Enable Meta Pixel" hint="Sends PageView on platform pages" defaultChecked={values.metaPixelEnabled} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LiveBadge live={pixelLive}>Live · {values.metaPixel}</LiveBadge>
              </div>
            </>
          )}
        </ActionForm>
      </Card>
    </>
  );
}
