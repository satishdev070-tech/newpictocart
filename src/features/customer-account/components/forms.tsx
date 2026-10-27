"use client";

import { UseMyLocation } from "@/features/geo/components/use-my-location";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { EmailCodeFlow } from "@/components/auth/email-code-flow";
import {
  cancelMyOrderAction,
  requestOtpAction,
  requestReturnAction,
  saveAddressAction,
  storeForgotPasswordAction,
  storeVerifyResetCodeAction,
  storeResetPasswordAction,
  storeSignInAction,
  storeSignUpAction,
  updateProfileAction,
  verifyOtpAction,
} from "@/features/customer-account/actions";
import { INDIAN_STATES } from "@/features/customer-account/address";
import { RETURN_REASONS } from "@/features/customer-account/schemas";
import { MAX_RETURN_PHOTO_BYTES, MAX_RETURN_PHOTOS, PHOTO_REQUIRED_REASONS, RETURN_PHOTO_ACCEPT } from "@/features/customer-account/return-photos";
import type { ActionResult } from "@/lib/actions/result";

function errs(state: ActionResult<unknown> | null) {
  return state && !state.ok ? (state.error.fieldErrors ?? {}) : {};
}

function Input({ label, name, errors, type, ...rest }: { label: string; name: string; errors: Record<string, string[]> } & React.InputHTMLAttributes<HTMLInputElement>) {
  const e = errors[name]?.[0];
  const [shown, setShown] = useState(false);
  const id = `ca-${name}`;
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && shown ? "text" : type}
          aria-invalid={e ? true : undefined}
          aria-describedby={e ? `${id}-error` : undefined}
          className={`sf-input w-full ${isPassword ? "pr-11" : ""}`}
          {...rest}
        />
        {isPassword ? (
          <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} className="sf-muted absolute inset-y-0 right-0 grid w-11 place-items-center hover:text-[var(--sf-text)]">
            {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        ) : null}
      </div>
      {e ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[var(--sf-sale)]">
          {e}
        </p>
      ) : null}
    </div>
  );
}

function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="text-sm text-[var(--sf-sale)]">
      {state.error.fieldErrors?._form?.[0] ?? state.error.message}
    </p>
  );
}

export function StoreSignIn({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "code">("password");
  const [pw, pwAction, pwPending] = useActionState(storeSignInAction, null);
  return (
    <div className="space-y-5">
      <div role="tablist" className="flex gap-4 text-sm">
        <button type="button" role="tab" aria-selected={mode === "password"} onClick={() => setMode("password")} className={mode === "password" ? "font-medium underline underline-offset-4" : "sf-muted"}>
          Password
        </button>
        <button type="button" role="tab" aria-selected={mode === "code"} onClick={() => setMode("code")} className={mode === "code" ? "font-medium underline underline-offset-4" : "sf-muted"}>
          Email me a code
        </button>
      </div>
      {mode === "password" ? (
        <form action={pwAction} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next} />
          <FormError state={pw} />
          <Input label="Email" name="email" type="email" autoComplete="email" required errors={errs(pw)} />
          <Input label="Password" name="password" type="password" autoComplete="current-password" required errors={errs(pw)} />
          <p className="-mt-2 text-right text-sm">
            <Link href="/account/forgot-password" className="sf-link-quiet">
              Forgot password?
            </Link>
          </p>
          <button type="submit" disabled={pwPending} className="sf-btn w-full">
            {pwPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <EmailCodeFlow tone="store" requestAction={requestOtpAction} verifyAction={verifyOtpAction} hidden={{ next }} emailLabel="Email" submitLabel="Send code" verifyLabel="Verify and sign in" />
      )}
      <p className="text-center text-sm">
        New here?{" "}
        <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="sf-link">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function StoreSignUp({ next }: { next: string }) {
  const [state, action, pending] = useActionState(storeSignUpAction, null);
  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div className="space-y-3">
        <p className="sf-heading text-center text-2xl">Confirm your email</p>
        <EmailCodeFlow tone="store" initialEmail={state.data.email} initialCodeLength={state.data.codeLength} requestAction={requestOtpAction} verifyAction={verifyOtpAction} hidden={{ next }} verifyLabel="Confirm and continue" />
      </div>
    );
  }
  const e = errs(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <div className="grid gap-4 @[30rem]:grid-cols-2">
        <Input label="First name" name="firstName" autoComplete="given-name" required errors={e} />
        <Input label="Last name" name="lastName" autoComplete="family-name" errors={e} />
      </div>
      <Input label="Email" name="email" type="email" autoComplete="email" required errors={e} />
      <Input label="Password" name="password" type="password" autoComplete="new-password" required errors={e} />
      <p className="sf-muted -mt-2 text-xs">At least 10 characters, with a letter and a number.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptsMarketing" value="true" className="accent-[var(--sf-primary)]" /> Send me offers and new arrivals
      </label>
      <button type="submit" disabled={pending} className="sf-btn w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="sf-muted text-xs">
        By creating an account you agree to our{" "}
        <Link href="/pages/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
      <p className="sf-border border-t pt-4 text-center text-sm">
        Already have an account?{" "}
        <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="sf-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ProfileForm({ initial }: { initial: { firstName: string; lastName: string; phone: string; acceptsMarketing: boolean } }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const e = errs(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      {state?.ok ? <p role="status" className="text-sm">Saved.</p> : null}
      <div className="grid gap-4 @[30rem]:grid-cols-2">
        <Input label="First name" name="firstName" defaultValue={initial.firstName} required errors={e} />
        <Input label="Last name" name="lastName" defaultValue={initial.lastName} errors={e} />
      </div>
      <Input label="Mobile number" name="phone" type="tel" defaultValue={initial.phone} errors={e} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptsMarketing" value="true" defaultChecked={initial.acceptsMarketing} /> Email me offers and new arrivals
      </label>
      <button type="submit" disabled={pending} className="sf-btn">
        Save
      </button>
    </form>
  );
}

export type AddressValue = { id?: string; label?: string | null; name: string; phone: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; postalCode: string; isDefault?: boolean };

export function AddressForm({ value, onDoneLabel = "Save address", locationAutofill = false }: { value?: AddressValue; onDoneLabel?: string; locationAutofill?: boolean }) {
  const [state, action, pending] = useActionState(saveAddressAction, null);
  const e = errs(state);
  return (
    <form action={action} className="grid gap-4 @[40rem]:grid-cols-2" noValidate>
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <div className="@[40rem]:col-span-2">
        <FormError state={state} />
        {state?.ok ? <p role="status" className="text-sm">Address saved.</p> : null}
        {locationAutofill ? <UseMyLocation /> : null}
      </div>
      <Input label="Label (e.g. Home)" name="label" defaultValue={value?.label ?? ""} errors={e} />
      <Input label="Full name" name="name" defaultValue={value?.name} required errors={e} />
      <Input label="Phone" name="phone" type="tel" defaultValue={value?.phone} required errors={e} />
      <Input label="PIN code" name="postalCode" inputMode="numeric" maxLength={6} defaultValue={value?.postalCode} required errors={e} />
      <div className="@[40rem]:col-span-2">
        <Input label="Flat, house no., building" name="line1" defaultValue={value?.line1} required errors={e} />
      </div>
      <div className="@[40rem]:col-span-2">
        <Input label="Area, street" name="line2" defaultValue={value?.line2 ?? ""} errors={e} />
      </div>
      <Input label="Landmark" name="landmark" defaultValue={value?.landmark ?? ""} errors={e} />
      <Input label="City" name="city" defaultValue={value?.city} required errors={e} />
      <div>
        <label htmlFor={`st-${value?.id ?? "new"}`} className="mb-1 block text-sm">
          State
        </label>
        <select id={`st-${value?.id ?? "new"}`} name="state" defaultValue={value?.state ?? ""} required className="sf-input w-full">
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" name="isDefault" value="true" defaultChecked={value?.isDefault} /> Default address
      </label>
      <div className="@[40rem]:col-span-2">
        <button type="submit" disabled={pending} className="sf-btn">
          {onDoneLabel}
        </button>
      </div>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(cancelMyOrderAction, null);
  if (state?.ok) return <p role="status" className="text-sm">Your order has been cancelled.</p>;
  return (
    <details>
      <summary className="sf-link cursor-pointer text-sm">Cancel order</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <label htmlFor="cancel-reason" className="block text-sm">
          Reason (optional)
        </label>
        <input id="cancel-reason" name="reason" maxLength={300} className="sf-input w-full" />
        <FormError state={state} />
        <button type="submit" disabled={pending} className="sf-btn sf-btn-outline">
          Confirm cancellation
        </button>
      </form>
    </details>
  );
}

export function ReturnRequestForm({ orderId, items }: { orderId: string; items: { id: string; title: string; variantTitle: string | null; returnable: number }[] }) {
  const [state, action, pending] = useActionState(requestReturnAction, null);
  const [reason, setReason] = useState("");
  if (state?.ok) return <p role="status" className="text-sm">Return requested. We&apos;ll email you with next steps.</p>;
  if (!items.some((i) => i.returnable > 0)) return null;
  const photoRequired = PHOTO_REQUIRED_REASONS.includes(reason);
  return (
    <details>
      <summary className="sf-link cursor-pointer text-sm">Request a return</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <ul className="space-y-2">
          {items
            .filter((i) => i.returnable > 0)
            .map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`rq-${i.id}`}>
                  {i.title}
                  {i.variantTitle ? ` · ${i.variantTitle}` : ""}
                </label>
                <select id={`rq-${i.id}`} name={`qty_${i.id}`} defaultValue="0" className="sf-input w-20 py-1">
                  {Array.from({ length: i.returnable + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </li>
            ))}
        </ul>
        <label htmlFor="rq-reason" className="block text-sm">
          Reason
        </label>
        <select id="rq-reason" name="reason" required className="sf-input w-full" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled>
            Choose a reason
          </option>
          {Object.entries(RETURN_REASONS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <ReturnPhotosInput required={photoRequired} error={errs(state).photos?.[0]} />
        <textarea name="note" maxLength={1000} rows={2} className="sf-input w-full" placeholder="Anything else we should know?" aria-label="Note" />
        {/* A photo problem is shown next to the photo field, not again as a generic form error. */}
        <FormError state={state && !state.ok && state.error.fieldErrors?.photos && !state.error.fieldErrors._form ? null : state} />
        <button type="submit" disabled={pending} className="sf-btn sf-btn-outline">
          {pending ? "Submitting…" : "Submit return request"}
        </button>
      </form>
    </details>
  );
}

/** Up to 5 photos with previews; checked again on the server by real file content. */
function ReturnPhotosInput({ required, error }: { required: boolean; error?: string }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const live = useRef<string[]>([]);
  useEffect(() => () => live.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const shown = localError ?? error;
  return (
    <div>
      <label htmlFor="rq-photos" className="block text-sm">
        Photos {required ? "(required for damaged items)" : "(optional)"}
      </label>
      <p id="rq-photos-hint" className="sf-muted mb-1.5 text-xs">
        Up to {MAX_RETURN_PHOTOS} JPG, PNG or WebP images, {MAX_RETURN_PHOTO_BYTES / 1024 / 1024} MB each.
      </p>
      <input
        id="rq-photos"
        name="photos"
        type="file"
        multiple
        accept={RETURN_PHOTO_ACCEPT}
        required={required}
        aria-invalid={shown ? true : undefined}
        aria-describedby={shown ? "rq-photos-hint rq-photos-error" : "rq-photos-hint"}
        className="block w-full text-sm"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          live.current.forEach((u) => URL.revokeObjectURL(u));
          live.current = list.slice(0, MAX_RETURN_PHOTOS).map((f) => URL.createObjectURL(f));
          setPreviews(live.current);
          if (list.length > MAX_RETURN_PHOTOS) setLocalError(`Attach up to ${MAX_RETURN_PHOTOS} photos.`);
          else if (list.some((f) => f.size > MAX_RETURN_PHOTO_BYTES)) setLocalError("Each photo must be 5 MB or smaller.");
          else setLocalError(null);
        }}
      />
      {previews.length ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected photos">
          {previews.map((src, n) => (
            <li key={src} className="sf-border size-16 overflow-hidden rounded border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={src} alt={`Selected photo ${n + 1}`} className="size-full object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {shown ? (
        <p id="rq-photos-error" role="alert" className="mt-1 text-sm text-[var(--sf-sale)]">
          {shown}
        </p>
      ) : null}
    </div>
  );
}

export function StoreForgotPassword() {
  return (
    <div className="space-y-4">
      <EmailCodeFlow tone="store" requestAction={storeForgotPasswordAction} verifyAction={storeVerifyResetCodeAction} emailLabel="Email" submitLabel="Send reset code" verifyLabel="Verify and set a new password" />
      <p className="text-center text-sm">
        <Link href="/account/login" className="sf-link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function StoreResetPassword() {
  const [state, action, pending] = useActionState(storeResetPasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Input label="New password" name="password" type="password" autoComplete="new-password" required errors={errs(state)} />
      <p className="sf-muted -mt-2 text-xs">At least 10 characters, with a letter and a number.</p>
      <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" required errors={errs(state)} />
      <button type="submit" disabled={pending} className="sf-btn w-full">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
