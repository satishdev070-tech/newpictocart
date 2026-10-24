"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/actions/result";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { TextField } from "@/components/ui/field";

/**
 * Email → 6-digit code → signed in. Used by the merchant sign-up / sign-in screens and the store
 * customer screens; the server actions decide what the code does (create, sign in, reset).
 *
 * Step 1: email (+ optional extra fields as hidden inputs). Step 2: "Enter the code sent to …",
 * six boxes (auto-advance, paste, backspace), Resend with a cooldown, Change email.
 */

type RequestAction = (prev: ActionResult<{ email: string }> | null, fd: FormData) => Promise<ActionResult<{ email: string }>>;
type VerifyAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export const CODE_LENGTH = 6;
export const RESEND_COOLDOWN_S = 30;

/** Digits only, at most `length` (paste of "855 189" → "855189"). Pure. */
export function cleanCode(raw: string, length = CODE_LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, length);
}

export function EmailCodeFlow({
  requestAction,
  verifyAction,
  hidden = {},
  emailLabel = "Email address",
  submitLabel = "Continue with email",
  verifyLabel = "Verify code",
  tone = "platform",
  initialEmail = null,
}: {
  requestAction: RequestAction;
  verifyAction: VerifyAction;
  hidden?: Record<string, string | null | undefined>;
  emailLabel?: string;
  submitLabel?: string;
  verifyLabel?: string;
  /** "store" follows the storefront theme (square buttons, uppercase labels come from its CSS). */
  tone?: "platform" | "store";
  /** Start on the code step for this email (e.g. after a store sign-up sent the confirmation code). */
  initialEmail?: string | null;
}) {
  const [reqState, request] = useActionState(requestAction, null);
  const [verState, verify] = useActionState(verifyAction, null);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(initialEmail ? RESEND_COOLDOWN_S : 0);
  const store = tone === "store";
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const verifyForm = useRef<HTMLFormElement>(null);

  // A successful request moves to the code step (adjusted during render, not in an effect).
  const [seenReq, setSeenReq] = useState(reqState);
  if (reqState !== seenReq) {
    setSeenReq(reqState);
    if (reqState?.ok) {
      setEmail(reqState.data.email);
      setCode("");
      setCooldown(RESEND_COOLDOWN_S);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const hiddenInputs = Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null));

  const resend = () => {
    if (!email || cooldown > 0) return;
    setResendNote(null);
    startResend(async () => {
      const fd = new FormData();
      fd.set("email", email);
      for (const [k, v] of Object.entries(hidden)) if (v) fd.set(k, v);
      const r = await requestAction(null, fd);
      setResendNote(r.ok ? "We sent a new code." : (r.error.fieldErrors?._form?.[0] ?? r.error.message));
      if (r.ok) setCooldown(RESEND_COOLDOWN_S);
    });
  };

  if (!email) {
    const errs = fieldErrors(reqState);
    return (
      <form action={request} className="space-y-4" noValidate>
        {hiddenInputs}
        {store ? <StoreMessage state={reqState} /> : <FormMessage state={reqState} />}
        {store ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{emailLabel}</span>
            <input name="email" type="email" autoComplete="email" inputMode="email" required className="sf-input w-full" aria-invalid={errs.email ? true : undefined} />
            {errs.email ? <span role="alert" className="mt-1.5 block text-xs text-[var(--sf-sale)]">{errs.email[0]}</span> : null}
          </label>
        ) : (
          <TextField label={emailLabel} name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@yourbusiness.in" errors={errs.email} />
        )}
        {store ? <StoreSubmit>{submitLabel}</StoreSubmit> : <SubmitButton className="w-full">{submitLabel}</SubmitButton>}
      </form>
    );
  }

  const errs = fieldErrors(verState);
  return (
    <form ref={verifyForm} action={verify} className="space-y-5 text-center">
      {hiddenInputs}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={code} />
      {store ? null : (
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <MailCheck aria-hidden className="size-6" />
        </span>
      )}
      <p className={cn("text-sm", store ? "sf-muted" : "text-muted")}>
        Enter the verification code we sent to <strong className={cn("break-all", !store && "text-foreground")}>{email}</strong>
      </p>
      {store ? <StoreMessage state={verState} /> : <FormMessage state={verState} />}
      <CodeBoxes
        value={code}
        onChange={setCode}
        onComplete={() => verifyForm.current?.requestSubmit()}
        invalid={Boolean(errs.token)}
        store={store}
      />
      {errs.token ? <p className={cn("text-sm", store ? "text-[var(--sf-sale)]" : "text-danger")}>{errs.token[0]}</p> : null}
      <p className={cn("text-sm", store ? "sf-muted" : "text-muted")}>
        Didn&apos;t get it?{" "}
        <button type="button" onClick={resend} disabled={cooldown > 0 || resending} className={cn("font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60", store ? "sf-link" : "text-accent disabled:text-muted")}>
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </p>
      {resendNote ? <p role="status" className={cn("text-xs", store ? "sf-muted" : "text-muted")}>{resendNote}</p> : null}
      {store ? (
        <StoreSubmit disabled={code.length !== CODE_LENGTH}>{verifyLabel}</StoreSubmit>
      ) : (
        <SubmitButton disabled={code.length !== CODE_LENGTH} className="w-full">
          {verifyLabel}
        </SubmitButton>
      )}
      <button
        type="button"
        onClick={() => {
          setEmail(null);
          setCode("");
          setResendNote(null);
        }}
        className={cn("text-sm font-medium underline underline-offset-2", store ? "sf-muted" : "text-muted hover:text-foreground")}
      >
        Change the email address
      </button>
    </form>
  );
}

/** Storefront submit button (the theme's .sf-btn). */
function StoreSubmit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="sf-btn w-full disabled:opacity-60">
      {pending ? "Please wait…" : children}
    </button>
  );
}

function StoreMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  const msg = state.error.fieldErrors?._form?.[0] ?? (state.error.fieldErrors ? null : state.error.message);
  return msg ? (
    <p role="alert" className="text-sm text-[var(--sf-sale)]">
      {msg}
    </p>
  ) : null;
}

function CodeBoxes({ value, onChange, onComplete, invalid, store }: { value: string; onChange: (v: string) => void; onComplete: () => void; invalid: boolean; store: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();

  const set = (next: string) => {
    onChange(next);
    if (next.length === CODE_LENGTH) setTimeout(onComplete, 0);
  };
  const onInput = (i: number, raw: string) => {
    const digits = cleanCode(raw);
    if (!digits) return;
    // Typing (or the OS filling one-time codes) can deliver several digits at once.
    const chars = value.padEnd(CODE_LENGTH, " ").split("");
    for (let k = 0; k < digits.length && i + k < CODE_LENGTH; k++) chars[i + k] = digits[k]!;
    set(cleanCode(chars.join("")));
    focus(i + digits.length);
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) set(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        set(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = cleanCode(e.clipboardData.getData("text"));
    if (!digits) return;
    e.preventDefault();
    set(digits);
    focus(digits.length);
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="Verification code">
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={CODE_LENGTH}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "size-11 text-center text-xl font-semibold tabular-nums sm:size-12",
            store
              ? cn("sf-input !px-0", invalid && "!border-[var(--sf-sale)]")
              : cn("rounded-lg border bg-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30", invalid ? "border-danger" : "border-border"),
          )}
        />
      ))}
    </div>
  );
}
