"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { createThemeFromReferenceAction } from "../actions";

/** Reference URL and/or screenshots → AI theme draft → opens the editor. */
export function CreateThemeForm({ industries, limits }: { industries: { value: string; label: string }[]; limits: { perHour: number; screenshots: number } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createThemeFromReferenceAction, null);
  const e = fieldErrors(state);
  useEffect(() => {
    if (state?.ok) router.push(`/admin/themes/${state.data.key}/edit?created=1`);
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state && !state.ok ? state : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Theme name" name="name" required minLength={2} maxLength={60} placeholder="e.g. Monsoon Linen" errors={e.name} />
        <SelectField label="Category" name="industry" required defaultValue="" options={[{ value: "", label: "Choose a category" }, ...industries]} errors={e.industry} hint="Sets the layout personality and the Unsplash photo set." />
      </div>
      <TextField label="Reference website" name="url" type="url" inputMode="url" placeholder="https://" maxLength={500} optional errors={e.url} hint="A public https:// page. We read its colours, fonts, header and section order only." />
      <div>
        <label htmlFor="f-screenshots" className="mb-1.5 block text-small font-medium">
          Reference screenshots <span className="font-normal text-muted">(optional, up to {limits.screenshots}, PNG/JPEG/WebP, 3.5 MB each)</span>
        </label>
        <input id="f-screenshots" name="screenshots" type="file" multiple accept="image/png,image/jpeg,image/webp" className="block w-full text-small file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-small" aria-describedby="screenshots-hint" />
        <p id="screenshots-hint" className="mt-1 text-caption text-muted">
          Full-page desktop screenshots work best. They are sent to the AI provider for this request only and are not stored.
        </p>
        {e.screenshots?.length ? (
          <p role="alert" className="mt-1 text-caption text-error">
            {e.screenshots[0]}
          </p>
        ) : null}
      </div>
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small">
        <p className="font-medium">Recreate the look, never the content.</p>
        <p className="mt-1 text-muted">
          The AI recreates layout, colours, typography and spacing in Pictocart&apos;s own sections. It never copies the reference&apos;s logo, brand name, text or images: copy is written fresh and every photo comes from Unsplash with credit. Use references you have the right to study.
        </p>
        <CheckboxField className="mt-2" label="I understand: only the visual style is recreated." name="acknowledge" required />
        {e.acknowledge?.length ? (
          <p role="alert" className="mt-1 text-caption text-error">
            {e.acknowledge[0]}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <Sparkles aria-hidden className="size-4" /> Create theme
        </SubmitButton>
        <span className="text-caption text-muted" aria-live="polite">
          {pending ? "Reading the reference and designing the theme… this can take up to a minute." : `Up to ${limits.perHour} AI themes per hour. The result is saved as a draft.`}
        </span>
      </div>
    </form>
  );
}
