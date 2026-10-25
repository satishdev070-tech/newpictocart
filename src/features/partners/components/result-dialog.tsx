"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { HiddenFields } from "@/features/settings/ui/action-controls";

/**
 * Dialog form whose success result is shown inside the dialog instead of closing it: used for
 * values that are shown exactly once (an invite link, a one-time code, a payout batch summary).
 * Closing the dialog clears the result, so the secret is not kept on screen.
 */
export function ResultDialog<T>({
  action,
  fields = {},
  title,
  description,
  triggerLabel,
  triggerVariant = "primary",
  confirmLabel,
  size = "md",
  wide,
  children,
  result,
}: {
  action: (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;
  fields?: Record<string, string>;
  title: string;
  description?: ReactNode;
  triggerLabel: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  confirmLabel: string;
  size?: ButtonProps["size"];
  wide?: boolean;
  children: (errors: Record<string, string[]>) => ReactNode;
  result: (data: T) => ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button variant={triggerVariant} size={size} onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </Button>
      <dialog ref={ref} aria-labelledby={titleId} onClose={() => setFormKey((k) => k + 1)} className={`m-auto rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40 ${wide ? "w-[min(94vw,640px)]" : "w-[min(92vw,480px)]"}`}>
        <ResultDialogBody key={formKey} action={action} fields={fields} title={title} titleId={titleId} description={description} confirmLabel={confirmLabel} onClose={() => ref.current?.close()} result={result}>
          {children}
        </ResultDialogBody>
      </dialog>
    </>
  );
}

function ResultDialogBody<T>({
  action,
  fields,
  title,
  titleId,
  description,
  confirmLabel,
  onClose,
  children,
  result,
}: {
  action: (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;
  fields: Record<string, string>;
  title: string;
  titleId: string;
  description?: ReactNode;
  confirmLabel: string;
  onClose: () => void;
  children: (errors: Record<string, string[]>) => ReactNode;
  result: (data: T) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  if (state?.ok) {
    return (
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {result(state.data)}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form action={formAction} className="max-h-[85vh] space-y-4 overflow-y-auto p-5">
      <HiddenFields fields={fields} />
      <div>
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <div className="mt-2 text-sm text-muted">{description}</div> : null}
      </div>
      <FormMessage state={state} />
      {children(fieldErrors(state))}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <SubmitButton>{confirmLabel}</SubmitButton>
      </div>
    </form>
  );
}

/** Read-only value with a copy button (invite links, one-time codes). */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div>
      <p className="mb-1.5 text-label">{label}</p>
      <div className="flex items-stretch gap-2">
        <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-small" />
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
