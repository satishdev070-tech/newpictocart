"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { CodeBoxes, RESEND_COOLDOWN_S, boxCount } from "@/components/auth/email-code-flow";
import { GoogleButton } from "@/components/auth/google-button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { OnbCard, OnbEyebrow, onbButton, onbError, onbField, onbLabel } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { PLATFORM_ICON } from "@/config/platform";
import { googleSignInAction, requestStartEmailCodeAction, verifyStartEmailCodeAction } from "@/features/auth/actions";
import { startCopy, type StartCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { draftStoreName } from "../draft/schema";

const submitClass = cn(
  "w-full !min-h-12 !rounded-full !border-0 !bg-mk-accent !text-[15px] !font-semibold !text-mk-accent-ink hover:!bg-mk-accent-hover focus-visible:!outline-mk-accent disabled:!opacity-45",
);

export function AccountScreen({
  draft,
  googleAvailable,
  onBack,
}: {
  draft: StartDraft;
  rootDomain: string;
  googleAvailable: boolean;
  onBack?: () => void;
}) {
  const c = startCopy(draft.locale);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const storeName = draftStoreName(draft) || "My store";
  const [email, setEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);

  const backLink = onBack ? (
    <button type="button" onClick={onBack} className={cn(onbButton.ghost, "mt-4")}>
      ← {c.back}
    </button>
  ) : null;

  if (codeEmail) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-start pt-4 sm:pt-8">
        <AuthCard>
          <BrandHeader
            eyebrow={c.account.eyebrow}
            title={c.account.codeTitle}
            titleAccent={c.account.codeTitleAccent}
            sub={null}
          />
          <StartCodeForm
            copy={c}
            email={codeEmail}
            type="email"
            draft={draft}
            storeName={storeName}
            onChangeEmail={() => setCodeEmail(null)}
          />
        </AuthCard>
        {backLink}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start pt-4 sm:pt-8">
      <AuthCard>
        <BrandHeader
          eyebrow={c.account.eyebrow}
          title={mode === "signup" ? c.account.title : c.account.signInTitle}
          titleAccent={mode === "signup" ? c.account.titleAccent : c.account.signInTitleAccent}
          sub={mode === "signup" ? c.account.valueLine : c.account.signInSub}
        />

        <div className="mt-6 space-y-4">
          {googleAvailable ? (
            <>
              <GoogleButton
                action={googleSignInAction}
                next="/start"
                label={mode === "signup" ? c.account.continueGoogle : c.account.signInGoogle}
                className="[&_button]:!rounded-full [&_button]:!py-3.5 [&_button]:!text-[15px]"
              />
              <OrDividerLabel label={c.account.or} />
            </>
          ) : null}

          <EmailCodeRequest
            copy={c}
            draft={draft}
            storeName={storeName}
            email={email}
            onEmailChange={setEmail}
            onSent={setCodeEmail}
            submitLabel={mode === "signup" ? c.account.sendCode : c.account.signInSubmit}
            showTerms={mode === "signup"}
          />
        </div>

        <p className="mt-6 text-center text-sm text-mk-muted">
          {mode === "signup" ? c.account.haveAccount : c.account.needAccount}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className={onbButton.link}
          >
            {mode === "signup" ? c.account.signIn : c.account.signUp}
          </button>
        </p>
      </AuthCard>
      {backLink}
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <OnbCard className="w-full p-5 sm:p-8">{children}</OnbCard>
  );
}

function BrandHeader({
  eyebrow,
  title,
  titleAccent,
  sub,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  sub: string | null;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLATFORM_ICON}
        alt=""
        width={56}
        height={56}
        className="mb-4 size-12 rounded-full bg-white object-contain p-1 ring-1 ring-mk-line-strong"
      />
      <OnbEyebrow>{eyebrow}</OnbEyebrow>
      <h2 className="mt-2 font-brand text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-mk-text sm:text-4xl">
        {title}
        <span className="text-mk-accent">{titleAccent}</span>
      </h2>
      {sub ? <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-mk-muted">{sub}</p> : null}
    </div>
  );
}

function OrDividerLabel({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-3 font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-dim" role="separator">
      <span className="h-px flex-1 bg-mk-line-strong" />
      {label}
      <span className="h-px flex-1 bg-mk-line-strong" />
    </div>
  );
}

function hiddenJourneyFields(draft: StartDraft, storeName: string) {
  return (
    <>
      <input type="hidden" name="next" value="/start" />
      <input type="hidden" name="storeName" value={storeName} />
      {draft.plan ? <input type="hidden" name="plan" value={draft.plan} /> : null}
      {draft.theme ? <input type="hidden" name="theme" value={draft.theme} /> : null}
      <input type="hidden" name="lang" value={draft.locale} />
      {draft.intent ? <input type="hidden" name="intent" value={draft.intent} /> : null}
    </>
  );
}

function TermsLine({ copy }: { copy: StartCopy }) {
  return (
    <p className="text-center text-xs text-mk-dim">
      {copy.account.agree}{" "}
      <Link href="/terms" className="text-mk-muted underline underline-offset-2 hover:text-mk-text">
        {copy.account.terms}
      </Link>{" "}
      {copy.account.and}{" "}
      <Link href="/privacy" className="text-mk-muted underline underline-offset-2 hover:text-mk-text">
        {copy.account.privacy}
      </Link>
      .
    </p>
  );
}

function EmailCodeRequest({
  copy,
  draft,
  storeName,
  email,
  onEmailChange,
  onSent,
  submitLabel,
  showTerms,
}: {
  copy: StartCopy;
  draft: StartDraft;
  storeName: string;
  email: string;
  onEmailChange: (email: string) => void;
  onSent: (email: string) => void;
  submitLabel: string;
  showTerms: boolean;
}) {
  const [state, action] = useActionState(requestStartEmailCodeAction, null);
  const errors = fieldErrors(state);
  useEffect(() => {
    if (state?.ok) onSent(state.data.email);
  }, [state, onSent]);

  return (
    <form action={action} className="space-y-4" noValidate>
      {hiddenJourneyFields(draft, storeName)}
      <FormMessage state={state} />
      <div>
        <label htmlFor="start-email" className={onbLabel}>
          {copy.account.email}
        </label>
        <input
          id="start-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@yourbusiness.in"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "start-email-error" : undefined}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className={onbField}
        />
        {errors.email ? (
          <p id="start-email-error" className={onbError}>
            {errors.email[0]}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" className={submitClass} disabled={!email.trim()}>
        {submitLabel}
      </SubmitButton>
      {showTerms ? <TermsLine copy={copy} /> : null}
    </form>
  );
}

function StartCodeForm({
  copy,
  email,
  type,
  draft,
  storeName,
  onChangeEmail,
}: {
  copy: StartCopy;
  email: string;
  type: "signup" | "email";
  draft: StartDraft;
  storeName: string;
  onChangeEmail: () => void;
}) {
  const [state, action] = useActionState(verifyStartEmailCodeAction, null);
  const errors = fieldErrors(state);
  const [code, setCode] = useState("");
  const [length] = useState(boxCount(undefined));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const canResend = type === "email";

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = () => {
    if (!canResend || cooldown > 0) return;
    setResendNote(null);
    startResend(async () => {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("next", "/start");
      fd.set("storeName", storeName);
      fd.set("lang", draft.locale);
      if (draft.plan) fd.set("plan", draft.plan);
      if (draft.theme) fd.set("theme", draft.theme);
      if (draft.intent) fd.set("intent", draft.intent);
      const r = await requestStartEmailCodeAction(null, fd);
      setResendNote(r.ok ? copy.account.resent : (r.error.fieldErrors?._form?.[0] ?? r.error.message));
      if (r.ok) {
        setCooldown(RESEND_COOLDOWN_S);
        setCode("");
      }
    });
  };

  return (
    <form ref={formRef} action={action} className="mt-6 space-y-5 text-center" noValidate>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-mk-accent-tint text-mk-accent">
        <MailCheck aria-hidden className="size-7" />
      </span>
      <div className="space-y-1.5">
        <p role="status" className="text-[15px] leading-relaxed text-mk-text">
          {copy.account.codeSentTo(email)}
        </p>
        <p className="text-xs text-mk-dim">{copy.account.checkEmail}</p>
      </div>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value="/start" />
      <input type="hidden" name="token" value={code} />
      <FormMessage state={state} />
      <CodeBoxes
        length={length}
        value={code}
        onChange={setCode}
        onComplete={() => formRef.current?.requestSubmit()}
        invalid={Boolean(errors.token)}
        className="[&_input]:h-12 [&_input]:w-10 [&_input]:rounded-[var(--r-sm)] [&_input]:border-mk-line-strong [&_input]:bg-mk-elev-2 [&_input]:text-lg [&_input]:font-semibold [&_input]:text-mk-text [&_input]:focus:border-mk-accent [&_input]:focus:ring-mk-accent/30 sm:[&_input]:h-14 sm:[&_input]:w-12"
      />
      {errors.token ? <p className={onbError}>{errors.token[0]}</p> : null}
      {canResend ? (
        <p className="text-sm text-mk-muted">
          {copy.account.didntGetIt}{" "}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="font-semibold text-mk-accent underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-mk-dim disabled:no-underline"
          >
            {resending ? copy.account.resending : cooldown > 0 ? copy.account.resendIn(cooldown) : copy.account.resend}
          </button>
        </p>
      ) : (
        <p className="text-sm text-mk-muted">{copy.account.codeHint}</p>
      )}
      {resendNote ? (
        <p role="status" className="text-xs text-mk-muted">
          {resendNote}
        </p>
      ) : null}
      <SubmitButton size="lg" className={submitClass} disabled={code.length !== length}>
        {copy.account.codeSubmit}
      </SubmitButton>
      <button
        type="button"
        onClick={onChangeEmail}
        className={onbButton.ghost}
      >
        {copy.account.changeEmail}
      </button>
    </form>
  );
}
