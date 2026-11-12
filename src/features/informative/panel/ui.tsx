"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { deleteContentAction, moveContentAction, uploadInformativeImageAction } from "../actions";

type Errors = Record<string, string[]>;
type FormAction<T> = (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;

/**
 * Panel form: server action through useActionState, the repo's FormMessage / SubmitButton, field
 * errors handed to the children. `redirectTo` navigates after success (e.g. back to a list).
 */
export function ActionForm<T>({
  action,
  children,
  submitLabel = "Save",
  success = "Saved.",
  redirectTo,
  className = "space-y-5",
}: {
  action: FormAction<T>;
  children: (errors: Errors) => ReactNode;
  submitLabel?: string;
  success?: string;
  redirectTo?: string | ((data: T) => string);
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok && redirectTo) router.push(typeof redirectTo === "function" ? redirectTo(state.data) : redirectTo);
  }, [state, redirectTo, router]);
  return (
    <form action={formAction} className={className} noValidate>
      {children(fieldErrors(state))}
      <FormMessage state={state} success={redirectTo ? undefined : success} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

/** Image picker: uploads to tenant/<id>/informative/ and keeps the storage path in a hidden input. */
export function ImageField({ name, label, initialPath, initialUrl, hint }: { name: string; label: string; initialPath?: string | null; initialUrl?: string | null; hint?: string }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [url, setUrl] = useState(initialUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = `img-${name}`;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadInformativeImageAction(fd);
    setBusy(false);
    if (r.ok) {
      setPath(r.data.path);
      setUrl(r.data.url);
    } else setError(r.error.fieldErrors?.file?.[0] ?? r.error.message);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-small font-medium">
        {label}
      </label>
      <input type="hidden" name={name} value={path} />
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- store asset preview
          <img src={url} alt="" width={64} height={64} className="size-16 rounded-md border border-border object-cover" />
        ) : (
          <span aria-hidden className="grid size-16 place-items-center rounded-md border border-dashed border-border text-muted">
            <ImagePlus className="size-5" />
          </span>
        )}
        <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} className="text-small" aria-describedby={`${id}-hint`} />
        {path ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPath(""); setUrl(null); }}>
            Remove
          </Button>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-caption text-muted" aria-live="polite">
        {busy ? "Uploading…" : error ?? hint ?? "JPG, PNG or WebP, up to 10 MB."}
      </p>
    </div>
  );
}

type Kind = "services" | "pages" | "gallery" | "team" | "testimonials" | "faqs";

/** Move up / down / delete for one row (no drag needed: works with keyboard and screen readers). */
export function RowControls({ kind, id, label, first, last, canDelete = true }: { kind: Kind; id: string; label: string; first: boolean; last: boolean; canDelete?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <form action={moveContentAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="dir" value="up" />
        <Button type="submit" variant="ghost" size="sm" disabled={first} aria-label={`Move ${label} up`}>
          <ArrowUp aria-hidden className="size-4" />
        </Button>
      </form>
      <form action={moveContentAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="dir" value="down" />
        <Button type="submit" variant="ghost" size="sm" disabled={last} aria-label={`Move ${label} down`}>
          <ArrowDown aria-hidden className="size-4" />
        </Button>
      </form>
      {canDelete ? (
        <ConfirmButton action={deleteContentAction} fields={{ kind, id }} title={`Delete ${label}?`} description="It disappears from your website. This can't be undone from the panel." confirmLabel="Delete">
          Delete
        </ConfirmButton>
      ) : null}
    </div>
  );
}
