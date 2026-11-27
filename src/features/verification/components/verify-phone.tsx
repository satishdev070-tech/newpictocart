"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { inputClassName, FieldError, Label } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/validation/phone";
import { sendPhoneCodeAction, verifyPhoneCodeAction } from "../actions";
import { claimStatusMessage } from "../schemas";

const RESEND_SECONDS = 30;
const tap = "min-h-11";

/**
 * My Profile → Verify WhatsApp number: enter number → Send code → 6-digit code → Verify.
 * After a successful check the server claims the verification bonus for store owners.
 */
export function VerifyPhoneForm({ phone, verified }: { phone: string | null; verified: boolean }) {
  const [editing, setEditing] = useState(!verified);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sendState, sendAction] = useActionState(async (prev: Awaited<ReturnType<typeof sendPhoneCodeAction>> | null, fd: FormData) => {
    const res = await sendPhoneCodeAction(prev, fd);
    if (res.ok) {
      const t = Date.now();
      setSentAt(t);
      setNow(t);
    }
    return res;
  }, null);
  const [verifyState, verifyAction] = useActionState(verifyPhoneCodeAction, null);

  const sent = sendState?.ok ? sendState.data : null;
  const done = verifyState?.ok ? verifyState.data : null;

  useEffect(() => {
    if (!sentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentAt]);
  const wait = sentAt ? Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000)) : 0;

  if (done) {
    const claim = done.claim;
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-small">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <div>
          <p className="font-semibold text-success">WhatsApp number verified</p>
          {claim && (claim.status === "claimed" || claim.status === "email_missing" || claim.status === "phone_used") ? <p className="text-muted">{claimStatusMessage(claim.status, claim.credits)}</p> : null}
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-small">
        <p className="flex items-center gap-2">
          <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />
          <span>
            <span className="block font-semibold text-success">WhatsApp verified</span>
            <span className="text-muted">{formatPhone(phone)}</span>
          </span>
        </p>
        <Button type="button" variant="ghost" className={tap} onClick={() => setEditing(true)}>
          Use a different number
        </Button>
      </div>
    );
  }

  const sendErrors = fieldErrors(sendState);
  const codeErrors = fieldErrors(verifyState);

  if (!sent) {
    return (
      <form action={sendAction} className="space-y-3" noValidate>
        <FormMessage state={sendState} />
        <div>
          <Label htmlFor="verify-phone">WhatsApp number</Label>
          <input
            id="verify-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={24}
            defaultValue={phone ?? ""}
            placeholder="98765 43210"
            aria-invalid={sendErrors.phone?.length ? true : undefined}
            aria-describedby={sendErrors.phone?.length ? "verify-phone-error" : "verify-phone-hint"}
            className={cn(inputClassName, tap)}
          />
          <p id="verify-phone-hint" className="mt-1.5 text-caption text-muted">
            We&apos;ll send a 6-digit code on WhatsApp. Indian numbers can be typed without +91.
          </p>
          <FieldError id="verify-phone-error" messages={sendErrors.phone} />
        </div>
        <SubmitButton className={cn(tap, "w-full sm:w-auto")}>
          <MessageCircle aria-hidden /> Send code
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-small">
        Code sent on WhatsApp to <strong className="whitespace-nowrap">{sent.display}</strong>. It works for 10 minutes.
      </p>
      {sent.devCode ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-small">
          Local testing (no WhatsApp sender set up): your code is <strong className="font-mono tracking-widest">{sent.devCode}</strong>
        </p>
      ) : null}
      <form action={verifyAction} className="space-y-3" noValidate>
        <input type="hidden" name="phone" value={sent.phone} />
        {verifyState && !verifyState.ok && !codeErrors.code ? <FormMessage state={verifyState} /> : null}
        <div>
          <Label htmlFor="verify-code">6-digit code</Label>
          <input
            id="verify-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="••••••"
            aria-invalid={codeErrors.code?.length ? true : undefined}
            aria-describedby={codeErrors.code?.length ? "verify-code-error" : undefined}
            className={cn(inputClassName, tap, "max-w-48 text-center font-mono text-h3 tracking-[0.4em]")}
          />
          <FieldError id="verify-code-error" messages={codeErrors.code} />
        </div>
        <SubmitButton className={cn(tap, "w-full sm:w-auto")}>Verify</SubmitButton>
      </form>
      {/* A failed resend returns to the number step, which shows the error. */}
      <form action={sendAction}>
        <input type="hidden" name="phone" value={sent.phone} />
        <SubmitButton variant="ghost" className={tap} disabled={wait > 0}>
          {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </SubmitButton>
      </form>
    </div>
  );
}
