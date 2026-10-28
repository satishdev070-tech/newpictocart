"use client";

import { useActionState, useEffect, useState } from "react";
import { TextAreaField, TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { ActionDialog } from "@/features/settings/ui/action-controls";
import { changePasswordAction, requestAccountDeletionAction, updateProfileAction } from "./actions";
import { countdown, formatCountdown } from "./schemas";

export type ProfileFormLabels = { fullName: string; phone: string; email: string; emailLocked: string; save: string; saved: string };

/** Name + phone (editable), email read-only. Writes the user's own profiles row. */
export function ProfileForm({ displayName, phone, email, labels }: { displayName: string; phone: string; email: string; labels: ProfileFormLabels }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const e = fieldErrors(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} success={labels.saved} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={labels.fullName} name="displayName" defaultValue={displayName} required maxLength={80} autoComplete="name" errors={e.displayName} />
        <TextField label={labels.phone} name="phone" type="tel" defaultValue={phone} placeholder="+91 98765 43210" autoComplete="tel" errors={e.phone} />
      </div>
      <TextField label={labels.email} name="email-readonly" type="email" value={email} readOnly disabled hint={labels.emailLocked} />
      <SubmitButton>{labels.save}</SubmitButton>
    </form>
  );
}

export type PasswordFormLabels = { newPassword: string; confirmPassword: string; update: string; updated: string };

export function ChangePasswordForm({ labels }: { labels: PasswordFormLabels }) {
  const [state, action] = useActionState(changePasswordAction, null);
  const e = fieldErrors(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} success={labels.updated} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField label={labels.newPassword} name="password" autoComplete="new-password" required minLength={10} errors={e.password} />
        <PasswordField label={labels.confirmPassword} name="confirm" autoComplete="new-password" required errors={e.confirm} />
      </div>
      <SubmitButton variant="secondary">{labels.update}</SubmitButton>
    </form>
  );
}

export type DeletionLabels = { button: string; title: string; body: string; reason: string; sent: string };

export function RequestDeletionButton({ labels }: { labels: DeletionLabels }) {
  return (
    <ActionDialog action={requestAccountDeletionAction} title={labels.title} description={labels.body} triggerLabel={labels.button} triggerVariant="danger" confirmLabel={labels.button} variant="danger" success={labels.sent}>
      {(e) => <TextAreaField label={labels.reason} name="reason" maxLength={500} rows={2} optional errors={e.reason} />}
    </ActionDialog>
  );
}

/** Live "300d : 22h : 01m" countdown to the plan / trial end. */
export function PlanCountdown({ endsAt, expiredLabel }: { endsAt: string; expiredLabel: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const c = countdown(endsAt, now);
  if (!c) return null;
  return (
    <span className="rounded-md bg-accent px-3 py-1.5 font-mono text-small font-bold tabular-nums text-white" suppressHydrationWarning>
      {c.expired ? expiredLabel : formatCountdown(c)}
    </span>
  );
}
