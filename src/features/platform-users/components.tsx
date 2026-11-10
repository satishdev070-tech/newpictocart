"use client";

import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { ActionDialog, HiddenFields } from "@/features/settings/ui/action-controls";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { addCustomerRoleAction, createAccountAction, deleteAccountAction, grantSuperAdminAction, revokeSuperAdminAction, sendAccountResetAction, setAccountStatusAction, setTemporaryPasswordAction, type AccountLinkResult } from "./actions";
import { DELETE_CONFIRM_PHRASE, isDeleteConfirmed } from "./rules";

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

/** Opens immediately (e.g. from a ⋮ menu item). Esc / backdrop close call `onClose`. */
function OpenDialog({ title, onClose, children }: { title: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
  const id = useId();
  const dialogId = `${id}-open`;
  const el = () => document.getElementById(dialogId) as HTMLDialogElement | null;
  // Closing the dialog (button or Esc) fires the native `close` event → onClose.
  const close = () => el()?.close();
  useEffect(() => {
    const d = el();
    if (!d) return;
    if (!d.open) d.showModal();
    const onNativeClose = () => onClose();
    d.addEventListener("close", onNativeClose);
    return () => d.removeEventListener("close", onNativeClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
  }, []);
  return (
    <dialog id={dialogId} aria-labelledby={id} className="m-auto w-[min(92vw,500px)] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40">
      <div className="space-y-4 p-5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {children(close)}
      </div>
    </dialog>
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

const reasonField = (errors?: string[]) => <TextAreaField label="Reason" name="reason" required minLength={10} maxLength={500} rows={2} errors={errors} hint="Recorded in the audit log." />;

function DialogButtons({ close, submit, danger }: { close: () => void; submit: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={close}>
        Cancel
      </Button>
      <SubmitButton variant={danger ? "danger" : "primary"}>{submit}</SubmitButton>
    </div>
  );
}

function TempPasswordBody({ userId, email, close }: { userId: string; email: string; close: () => void }) {
  const [state, action] = useActionState(setTemporaryPasswordAction, null);
  const [copied, setCopied] = useState(false);
  if (state?.ok)
    return (
      <div className="space-y-3 text-sm">
        <p role="status" className="text-success">
          Temporary password set for {email}. It is shown only once: share it securely and ask them to change it from My Profile.
        </p>
        <div className="flex gap-2">
          <input readOnly value={state.data.password} aria-label="Temporary password" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(state.data.password).then(() => setCopied(true))}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <HiddenFields fields={{ userId }} />
      <p className="text-sm text-muted">Replaces the current password of {email} with a generated one. Their old password stops working at once.</p>
      <FormMessage state={state} />
      {reasonField(fieldErrors(state).reason)}
      <DialogButtons close={close} submit="Set temporary password" danger />
    </form>
  );
}

function AddCustomerBody({ userId, stores, close }: { userId: string; stores: { id: string; name: string }[]; close: () => void }) {
  const [state, action] = useActionState(addCustomerRoleAction, null);
  const e = fieldErrors(state);
  if (state?.ok)
    return (
      <div className="space-y-3 text-sm">
        <p role="status" className="text-success">Added as a customer of {state.data.storeName}.</p>
        <div className="flex justify-end">
          <Button size="sm" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <HiddenFields fields={{ userId }} />
      <p className="text-sm text-muted">Creates a shopper record in the store, linked to this account, so they can sign in to that store&apos;s account pages.</p>
      <FormMessage state={state} />
      <SelectField label="Store" name="tenantId" required errors={e.tenantId} defaultValue="" options={[{ value: "", label: "Choose a store" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]} />
      {reasonField(e.reason)}
      <DialogButtons close={close} submit="Add customer role" />
    </form>
  );
}

function DeleteBody({ userId, email, ownedStores, close }: { userId: string; email: string; ownedStores: string[]; close: () => void }) {
  const [state, action] = useActionState(deleteAccountAction, null);
  const [typed, setTyped] = useState("");
  const router = useRouter();
  const e = fieldErrors(state);
  if (state?.ok)
    return (
      <div className="space-y-3 text-sm">
        <p role="status" className="text-success">
          Deleted {state.data.email ?? "the account"}
          {state.data.deletedStores.length ? ` and ${state.data.deletedStores.length} store${state.data.deletedStores.length === 1 ? "" : "s"} (${state.data.deletedStores.join(", ")})` : ""}.
          {state.data.keptStores.length ? ` Kept shared stores: ${state.data.keptStores.join(", ")}.` : ""}
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              close();
              router.push("/admin/users");
              router.refresh();
            }}
          >
            Back to users
          </Button>
        </div>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <HiddenFields fields={{ userId }} />
      <div role="note" className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
        This permanently deletes {email} and cannot be undone.
        {ownedStores.length ? ` Stores they own (${ownedStores.join(", ")}) are deleted too, with their products, orders and customers, unless another owner shares them.` : " They own no stores."}
      </div>
      <FormMessage state={state} />
      {reasonField(e.reason)}
      <TextField
        label={`Type ${DELETE_CONFIRM_PHRASE} to confirm`}
        name="confirm"
        required
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(ev) => setTyped(ev.currentTarget.value)}
        errors={e.confirm}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <SubmitButton variant="danger" disabled={!isDeleteConfirmed(typed)}>
          Delete account
        </SubmitButton>
      </div>
    </form>
  );
}

export type AccountActionsProps = {
  userId: string;
  email: string | null;
  disabled: boolean;
  /** Not platform staff and not the acting admin. */
  manageable: boolean;
  self: boolean;
  /** Target's platform role, if any. */
  platformRole: string | null;
  actorIsSuperAdmin: boolean;
  stores: { id: string; name: string }[];
  ownedStores: string[];
};

/** Account actions for one user (detail page). Rules mirror rules.ts; the server re-checks everything. */
export function AccountActions({ userId, email, disabled, manageable, self, platformRole, actorIsSuperAdmin, stores, ownedStores }: AccountActionsProps) {
  if (self) return <p className="text-caption text-muted">This is your account. Manage it from My Profile.</p>;
  const superAdminToggle = actorIsSuperAdmin ? (
    platformRole === "super_admin" ? (
      <ActionDialog
        action={revokeSuperAdminAction}
        fields={{ userId }}
        title="Remove super admin?"
        description="They lose access to this console at once. Their stores and customer records stay."
        triggerLabel="Remove super admin"
        confirmLabel="Remove"
        variant="danger"
        success="Super admin removed."
      >
        {(e) => reasonField(e.reason)}
      </ActionDialog>
    ) : !platformRole ? (
      <ActionDialog
        action={grantSuperAdminAction}
        fields={{ userId }}
        title="Make super admin?"
        description="Full access to every store, user and platform setting. They sign in on the same page and land in this console."
        triggerLabel="Make super admin"
        confirmLabel="Make super admin"
        success="Super admin granted."
      >
        {(e) => reasonField(e.reason)}
      </ActionDialog>
    ) : null
  ) : null;
  if (!manageable || !email)
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">{superAdminToggle}</div>
        <p className="text-caption text-muted">Platform staff are managed on Platform users. Remove their platform access to manage the account here.</p>
      </div>
    );
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog title="Send a password reset link" trigger="Reset password">
        {(close) => <ResetBody userId={userId} email={email} close={close} />}
      </Dialog>
      {actorIsSuperAdmin ? (
        <Dialog title="Set a temporary password" trigger="Temporary password">
          {(close) => <TempPasswordBody userId={userId} email={email} close={close} />}
        </Dialog>
      ) : null}
      <Dialog title="Add the Customer role" trigger="Add customer role">
        {(close) => <AddCustomerBody userId={userId} stores={stores} close={close} />}
      </Dialog>
      {superAdminToggle}
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
        {(e) => reasonField(e.reason)}
      </ActionDialog>
      {actorIsSuperAdmin ? (
        <Dialog title="Delete user" trigger="Delete user" triggerVariant="ghost">
          {(close) => <DeleteBody userId={userId} email={email} ownedStores={ownedStores} close={close} />}
        </Dialog>
      ) : null}
    </div>
  );
}

function ReasonActionBody({
  action,
  userId,
  description,
  submit,
  success,
  danger,
  close,
}: {
  action: typeof grantSuperAdminAction;
  userId: string;
  description: string;
  submit: string;
  success: string;
  danger?: boolean;
  close: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const { show } = useToast();
  useEffect(() => {
    if (state?.ok) {
      show({ tone: "success", message: success });
      close();
    }
  }, [state, show, success, close]);
  return (
    <form action={formAction} className="space-y-4">
      <HiddenFields fields={{ userId }} />
      <p className="text-sm text-muted">{description}</p>
      <FormMessage state={state} />
      {reasonField(fieldErrors(state).reason)}
      <DialogButtons close={close} submit={submit} danger={danger} />
    </form>
  );
}

export type UserRowMenuProps = {
  userId: string;
  email: string | null;
  platformRole: string | null;
  actorIsSuperAdmin: boolean;
  self: boolean;
  /** All stores (Add customer role). */
  storeOptions: { id: string; name: string }[];
  /** Memberships for quick store links. */
  stores: { tenantId: string; name: string }[];
  ownedStores: string[];
};

type RowDialog = "reset" | "temp" | "customer" | "delete" | "grant" | "revoke";

/** ⋮ menu on a directory row — same actions as the detail page AccountActions. */
export function UserRowMenu({ userId, email, platformRole, actorIsSuperAdmin, self, storeOptions, stores, ownedStores }: UserRowMenuProps) {
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const closeDialog = () => setDialog(null);
  const manageable = !platformRole && !self;
  const titles: Record<RowDialog, string> = {
    reset: "Send a password reset link",
    temp: "Set a temporary password",
    customer: "Add the Customer role",
    delete: "Delete user",
    grant: "Make super admin?",
    revoke: "Remove super admin?",
  };
  return (
    <>
      <Popover trigger={<MoreVertical className="size-4" aria-hidden />} label="User actions" className="w-60">
        <PopoverItem href={`/admin/users/${userId}`}>View details & activity</PopoverItem>
        {stores.slice(0, 3).map((s) => (
          <PopoverItem key={s.tenantId} href={`/admin/tenants/${s.tenantId}`}>
            Open store: {s.name}
          </PopoverItem>
        ))}
        <PopoverItem href={`/admin/audit?actor=${userId}`}>Audit log entries</PopoverItem>
        {manageable && email ? (
          <>
            <PopoverItem onClick={() => setDialog("reset")}>Reset password</PopoverItem>
            {actorIsSuperAdmin ? <PopoverItem onClick={() => setDialog("temp")}>Temporary password</PopoverItem> : null}
            <PopoverItem onClick={() => setDialog("customer")}>Add customer role</PopoverItem>
          </>
        ) : null}
        {actorIsSuperAdmin && !self && !platformRole ? <PopoverItem onClick={() => setDialog("grant")}>Make super admin</PopoverItem> : null}
        {actorIsSuperAdmin && !self && platformRole === "super_admin" ? <PopoverItem onClick={() => setDialog("revoke")}>Remove super admin</PopoverItem> : null}
        {actorIsSuperAdmin && manageable && email ? (
          <PopoverItem onClick={() => setDialog("delete")}>
            <span className="text-error">Delete</span>
          </PopoverItem>
        ) : null}
      </Popover>
      {dialog ? (
        <OpenDialog title={titles[dialog]} onClose={closeDialog}>
          {(close) => {
            if (dialog === "grant")
              return (
                <ReasonActionBody
                  action={grantSuperAdminAction}
                  userId={userId}
                  description="Full access to every store, user and platform setting. They sign in on the same page and land in this console."
                  submit="Make super admin"
                  success="Super admin granted."
                  close={close}
                />
              );
            if (dialog === "revoke")
              return (
                <ReasonActionBody
                  action={revokeSuperAdminAction}
                  userId={userId}
                  description="They lose access to this console at once. Their stores and customer records stay."
                  submit="Remove"
                  success="Super admin removed."
                  danger
                  close={close}
                />
              );
            if (!email) return null;
            if (dialog === "reset") return <ResetBody userId={userId} email={email} close={close} />;
            if (dialog === "temp") return <TempPasswordBody userId={userId} email={email} close={close} />;
            if (dialog === "customer") return <AddCustomerBody userId={userId} stores={storeOptions} close={close} />;
            return <DeleteBody userId={userId} email={email} ownedStores={ownedStores} close={close} />;
          }}
        </OpenDialog>
      ) : null}
    </>
  );
}
