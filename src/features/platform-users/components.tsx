"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { ActionDialog, HiddenFields } from "@/features/settings/ui/action-controls";
import { createAccountAction, sendAccountResetAction, setAccountStatusAction, type AccountLinkResult } from "./actions";

function Dialog({ title, trigger, triggerVariant = "secondary", children }: { title: string; trigger: ReactNode; triggerVariant?: "secondary" | "ghost" | "primary"; children: (close: () => void) => ReactNode }) {
  const id = useId();
  const dialogId = `${id}-dialog`;
  const el = () => document.getElementById(dialogId) as HTMLDialogElement | null;
  const close = () => el()?.close();
  return (
    <>
      <Button size="sm" variant={triggerVariant} onClick={() => el()?.showModal()}>
        {trigger}
      </Button>
      <dialog id={dialogId} aria-labelledby={id} className="m-auto w-[min(92vw,500px)] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40">
        <div className="space-y-4 p-5">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {children(close)}
        </div>
      </dialog>
    </>
  );
}

/** Shows a one-time link once, with the email outcome. */
function LinkResult({ d, close, sentLabel }: { d: AccountLinkResult; close: () => void; sentLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <p role="status" className={d.emailStatus === "sent" || !d.link ? "text-success" : "text-warning"}>
        {!d.link ? `Account created for ${d.email}. They can sign in with the password you set.` : d.emailStatus === "sent" ? `${sentLabel} ${d.email}.` : d.emailStatus === "logged" ? "Email is not configured (Admin → Email), so nothing was sent. Share the link below securely." : "The email couldn't be sent. Share the link below securely."}
      </p>
      {d.link ? (
        <div>
          <p className="mb-1 text-muted">One-time link (expires soon; works once):</p>
          <div className="flex gap-2">
            <input readOnly value={d.link} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="One-time link" />
            <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(d.link!).then(() => setCopied(true))}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}

function CreateAccountBody({ close }: { close: () => void }) {
  const [state, action] = useActionState(createAccountAction, null as ActionResult<AccountLinkResult> | null);
  const e = fieldErrors(state);
  if (state?.ok) return <LinkResult d={state.data} close={close} sentLabel="Set-password email sent to" />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <TextField label="Name" name="displayName" required maxLength={120} errors={e.displayName} />
      <TextField label="Email" name="email" type="email" required errors={e.email} />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" optional minLength={10} errors={e.password} hint="Leave blank to email a one-time link to set their own password (recommended)." />
      <p className="text-caption text-muted">The account is created without a store. They can create one from the seller sign-in. Platform staff are added on Platform users.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}

export function AddUserButton() {
  return (
    <Dialog title="Add user" trigger="Add user" triggerVariant="primary">
      {(close) => <CreateAccountBody close={close} />}
    </Dialog>
  );
}

function ResetBody({ userId, email, close }: { userId: string; email: string; close: () => void }) {
  const [state, action] = useActionState(sendAccountResetAction, null as ActionResult<AccountLinkResult> | null);
  if (state?.ok) return <LinkResult d={state.data} close={close} sentLabel="Reset email sent to" />;
  return (
    <form action={action} className="space-y-4">
      <HiddenFields fields={{ userId }} />
      <p className="text-sm text-muted">Emails {email} a one-time link to choose a new password. Their current password keeps working until they change it.</p>
      <FormMessage state={state} />
      <TextAreaField label="Reason" name="reason" required minLength={10} maxLength={500} rows={2} errors={fieldErrors(state).reason} hint="Recorded in the audit log." />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <SubmitButton>Send reset link</SubmitButton>
      </div>
    </form>
  );
}

/** Account actions for one user (detail page). Staff accounts and your own are read-only here. */
export function AccountActions({ userId, email, disabled, manageable }: { userId: string; email: string | null; disabled: boolean; manageable: boolean }) {
  if (!manageable || !email) return <p className="text-caption text-muted">Platform staff and your own account are managed on Platform users.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog title="Send a password reset link" trigger="Reset password">
        {(close) => <ResetBody userId={userId} email={email} close={close} />}
      </Dialog>
      <ActionDialog
        action={setAccountStatusAction}
        fields={{ userId, status: disabled ? "active" : "disabled" }}
        title={disabled ? "Enable this account?" : "Disable this account?"}
        description={disabled ? "They can sign in again." : "They are signed out and can't sign in until you enable the account. Stores and orders are kept."}
        triggerLabel={disabled ? "Enable account" : "Disable account"}
        confirmLabel={disabled ? "Enable" : "Disable"}
        variant={disabled ? "primary" : "danger"}
        success={disabled ? "Account enabled." : "Account disabled."}
      >
        {(e) => <TextAreaField label="Reason" name="reason" required minLength={10} maxLength={500} rows={2} errors={e.reason} hint="Recorded in the audit log." />}
      </ActionDialog>
    </div>
  );
}

/** ⋮ menu on a directory row. */
export function UserRowMenu({ userId, stores }: { userId: string; stores: { tenantId: string; name: string }[] }) {
  return (
    <Popover trigger={<MoreVertical className="size-4" aria-hidden />} label="User actions" className="w-60">
      <PopoverItem href={`/admin/users/${userId}`}>View details & activity</PopoverItem>
      {stores.slice(0, 3).map((s) => (
        <PopoverItem key={s.tenantId} href={`/admin/tenants/${s.tenantId}`}>
          Open store: {s.name}
        </PopoverItem>
      ))}
      <PopoverItem href={`/admin/audit?actor=${userId}`}>Audit log entries</PopoverItem>
    </Popover>
  );
}
