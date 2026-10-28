"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { CodeBoxes, RESEND_COOLDOWN_S, boxCount } from "@/components/auth/email-code-flow";
import { GoogleButton } from "@/components/auth/google-button";
import { TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { PasswordField } from "@/components/ui/password-field";
import { PLATFORM_ICON } from "@/config/platform";
import { googleSignInAction, requestStartEmailCodeAction, signInAction, signUpAction, verifyStartEmailCodeAction } from "@/features/auth/actions";
import type { ActionResult } from "@/lib/actions/result";
import { LivePreview } from "../components/live-preview";
import { startCopy, type StartCopy } from "../copy";
import { industryName, isIndustry } from "@/features/stores/industries";
import { subcategoryLabel } from "@/features/stores/subcategories";
import type { StartDraft } from "../draft/schema";
import { draftCategory, draftStoreName, draftSubcategory } from "../draft/schema";

const submitClass = "w-full !rounded-full !bg-[#F97316] !text-white hover:!bg-[#EA580C] focus-visible:!outline-[#F97316]";

export function AccountScreen({
  draft,
  rootDomain,
  googleAvailable,
}: {
  draft: StartDraft;
  rootDomain: string;
  googleAvailable: boolean;
}) {
  const c = startCopy(draft.locale);
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const storeName = draftStoreName(draft) || "My store";
  const category = draftCategory(draft);
  const subcategory = draftSubcategory(draft);
  const categoryLabel = category && isIndustry(category) ? industryName(category) : null;
  const subcategoryText = category && subcategory ? subcategoryLabel(category, subcategory) : null;

  return (
    <>
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <div className="rounded-[28px] border border-white/90 bg-white/80 p-6 shadow-[0_20px_50px_-28px_rgba(42,34,51,0.35)] backdrop-blur-md sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PLATFORM_ICON} alt="" width={48} height={48} className="mb-4 size-12 rounded-2xl object-contain shadow-sm" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C2410C]">{c.account.eyebrow}</p>
            <h2 className="mt-2 font-brand text-3xl leading-tight sm:text-4xl">
              {c.account.title}
              <span className="text-[#C2410C]">{c.account.titleAccent}</span>
            </h2>
            <p className="mt-2 max-w-sm text-sm text-[#5E5568]">{c.account.valueLine}</p>
          </div>

          <StoreSummary
            copy={c}
            storeName={storeName}
            categoryLabel={categoryLabel}
            subcategoryText={subcategoryText}
            theme={draft.theme}
            locale={draft.locale}
          />

          <div className="mt-5 flex gap-1 rounded-full bg-[#F4EEE8] p-1" role="tablist" aria-label="Account mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => setTab("signup")}
              className={
                tab === "signup"
                  ? "flex-1 rounded-full bg-white py-2 text-sm font-semibold text-[#2A2233] shadow-sm"
                  : "flex-1 rounded-full py-2 text-sm text-[#6B6275]"
              }
            >
              {c.account.signUp}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signin"}
              onClick={() => setTab("signin")}
              className={
                tab === "signin"
                  ? "flex-1 rounded-full bg-white py-2 text-sm font-semibold text-[#2A2233] shadow-sm"
                  : "flex-1 rounded-full py-2 text-sm text-[#6B6275]"
              }
            >
              {c.account.signIn}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {googleAvailable ? (
              <>
                <GoogleButton action={googleSignInAction} next="/start" label={c.account.continueGoogle} className="[&_button]:!rounded-full" />
                <OrDividerLabel label={c.account.or} />
              </>
            ) : null}
            {tab === "signup" ? (
              <StartSignUpForm copy={c} draft={draft} storeName={storeName} />
            ) : (
              <StartSignInForm copy={c} draft={draft} storeName={storeName} />
            )}
          </div>
        </div>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} rootDomain={rootDomain} draft={draft} />
      </div>
    </>
  );
}

function OrDividerLabel({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-3 text-xs uppercase tracking-wider text-[#6B6275]" role="separator">
      <span className="h-px flex-1 bg-[#2A2233]/12" />
      {label}
      <span className="h-px flex-1 bg-[#2A2233]/12" />
    </div>
  );
}

function StoreSummary({
  copy,
  storeName,
  categoryLabel,
  subcategoryText,
  theme,
  locale,
}: {
  copy: StartCopy;
  storeName: string;
  categoryLabel: string | null;
  subcategoryText: string | null;
  theme: string | null | undefined;
  locale: string;
}) {
  const bits = [
    { label: copy.account.summaryStore, value: storeName },
    categoryLabel ? { label: copy.account.summaryCategory, value: subcategoryText ? `${categoryLabel} · ${subcategoryText}` : categoryLabel } : null,
    theme ? { label: copy.account.summaryTheme, value: theme } : null,
    { label: copy.account.summaryLanguage, value: locale },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-center text-xs text-[#6B6275]" aria-label="Store summary">
      {bits.map((b) => (
        <li key={b.label} className="inline-flex items-center gap-1.5">
          <span className="text-[#9A91A4]">{b.label}</span>
          <span className="font-medium text-[#3F3A47]">{b.value}</span>
        </li>
      ))}
    </ul>
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

function StartSignUpForm({ copy, draft, storeName }: { copy: StartCopy; draft: StartDraft; storeName: string }) {
  const [method, setMethod] = useState<"code" | "password">("code");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const [passwordState, passwordAction] = useActionState(signUpAction, null);
  const passwordErrors = fieldErrors(passwordState);

  if (passwordState?.ok && passwordState.data.needsConfirmation && email) {
    return (
      <StartCodeForm
        copy={copy}
        email={email}
        type="signup"
        draft={draft}
        storeName={storeName}
        displayName={name}
        onChangeEmail={() => {
          setCodeEmail(null);
          setMethod("password");
        }}
      />
    );
  }
  if (codeEmail) {
    return (
      <StartCodeForm
        copy={copy}
        email={codeEmail}
        type="email"
        draft={draft}
        storeName={storeName}
        displayName={name}
        onChangeEmail={() => setCodeEmail(null)}
      />
    );
  }

  if (method === "password") {
    return (
      <div className="space-y-4">
        <form action={passwordAction} className="space-y-4" noValidate>
          {hiddenJourneyFields(draft, storeName)}
          <FormMessage state={passwordState} />
          <TextField
            label={copy.account.name}
            name="displayName"
            autoComplete="name"
            required
            errors={passwordErrors.displayName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label={copy.account.email}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            errors={passwordErrors.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            label={copy.account.password}
            name="password"
            autoComplete="new-password"
            required
            errors={passwordErrors.password}
            hint={copy.account.passwordHint}
          />
          <SubmitButton size="lg" className={submitClass}>
            {copy.account.create}
          </SubmitButton>
          <TermsLine copy={copy} />
        </form>
        <button type="button" onClick={() => setMethod("code")} className="w-full text-center text-sm font-medium text-[#C2410C] underline-offset-2 hover:underline">
          {copy.account.useEmailCode}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EmailCodeRequest
        copy={copy}
        draft={draft}
        storeName={storeName}
        email={email}
        onEmailChange={setEmail}
        displayName={name}
        onDisplayNameChange={setName}
        showName
        onSent={setCodeEmail}
      />
      <button type="button" onClick={() => setMethod("password")} className="w-full text-center text-sm font-medium text-[#6B6275] underline-offset-2 hover:underline">
        {copy.account.usePassword}
      </button>
    </div>
  );
}

function StartSignInForm({ copy, draft, storeName }: { copy: StartCopy; draft: StartDraft; storeName: string }) {
  const [method, setMethod] = useState<"code" | "password">("code");
  const [email, setEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const [passwordState, passwordAction] = useActionState(signInAction, null);
  const passwordErrors = fieldErrors(passwordState);

  if (codeEmail) {
    return (
      <StartCodeForm
        copy={copy}
        email={codeEmail}
        type="email"
        draft={draft}
        storeName={storeName}
        onChangeEmail={() => setCodeEmail(null)}
      />
    );
  }

  if (method === "password") {
    return (
      <div className="space-y-4">
        <form action={passwordAction} className="space-y-4" noValidate>
          <input type="hidden" name="next" value="/start" />
          <FormMessage state={passwordState as ActionResult<unknown> | null} />
          <TextField
            label={copy.account.email}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            errors={passwordErrors.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField label={copy.account.password} name="password" autoComplete="current-password" required errors={passwordErrors.password} />
          <SubmitButton size="lg" className={submitClass}>
            {copy.account.signInSubmit}
          </SubmitButton>
        </form>
        <button type="button" onClick={() => setMethod("code")} className="w-full text-center text-sm font-medium text-[#C2410C] underline-offset-2 hover:underline">
          {copy.account.useEmailCode}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EmailCodeRequest copy={copy} draft={draft} storeName={storeName} email={email} onEmailChange={setEmail} onSent={setCodeEmail} />
      <button type="button" onClick={() => setMethod("password")} className="w-full text-center text-sm font-medium text-[#6B6275] underline-offset-2 hover:underline">
        {copy.account.usePassword}
      </button>
    </div>
  );
}

function TermsLine({ copy }: { copy: StartCopy }) {
  return (
    <p className="text-center text-xs text-[#6B6275]">
      {copy.account.agree}{" "}
      <Link href="/terms" className="underline underline-offset-2">
        {copy.account.terms}
      </Link>{" "}
      {copy.account.and}{" "}
      <Link href="/privacy" className="underline underline-offset-2">
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
  displayName,
  onDisplayNameChange,
  showName,
  onSent,
}: {
  copy: StartCopy;
  draft: StartDraft;
  storeName: string;
  email: string;
  onEmailChange: (email: string) => void;
  displayName?: string;
  onDisplayNameChange?: (name: string) => void;
  showName?: boolean;
  onSent: (email: string) => void;
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
      {showName && onDisplayNameChange ? (
        <TextField
          label={copy.account.name}
          name="displayName"
          autoComplete="name"
          optional
          value={displayName ?? ""}
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />
      ) : displayName ? (
        <input type="hidden" name="displayName" value={displayName} />
      ) : null}
      <TextField
        label={copy.account.email}
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        placeholder="you@yourbusiness.in"
        errors={errors.email}
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
      />
      <SubmitButton size="lg" className={submitClass} disabled={!email.trim()}>
        {copy.account.sendCode}
      </SubmitButton>
      {showName ? <TermsLine copy={copy} /> : null}
    </form>
  );
}

function StartCodeForm({
  copy,
  email,
  type,
  draft,
  storeName,
  displayName,
  onChangeEmail,
}: {
  copy: StartCopy;
  email: string;
  type: "signup" | "email";
  draft: StartDraft;
  storeName: string;
  displayName?: string;
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
      if (displayName) fd.set("displayName", displayName);
      const r = await requestStartEmailCodeAction(null, fd);
      setResendNote(r.ok ? copy.account.resent : (r.error.fieldErrors?._form?.[0] ?? r.error.message));
      if (r.ok) {
        setCooldown(RESEND_COOLDOWN_S);
        setCode("");
      }
    });
  };

  return (
    <form ref={formRef} action={action} className="space-y-5 text-center" noValidate>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#FFF1E6] text-[#EA580C]">
        <MailCheck aria-hidden className="size-6" />
      </span>
      <div className="space-y-1">
        <p role="status" className="text-sm text-[#5E5568]">
          {copy.account.codeSentTo(email)}
        </p>
        <p className="text-xs text-[#9A91A4]">{copy.account.checkEmail}</p>
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
        className="[&_input]:border-[#E8DFD6] [&_input]:focus:border-[#F97316] [&_input]:focus:ring-[#F97316]/25"
      />
      {errors.token ? <p className="text-sm text-danger">{errors.token[0]}</p> : null}
      {canResend ? (
        <p className="text-sm text-[#6B6275]">
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="font-semibold text-[#C2410C] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#9A91A4] disabled:no-underline"
          >
            {resending ? copy.account.resending : cooldown > 0 ? copy.account.resendIn(cooldown) : copy.account.resend}
          </button>
        </p>
      ) : (
        <p className="text-sm text-[#6B6275]">{copy.account.codeHint}</p>
      )}
      {resendNote ? (
        <p role="status" className="text-xs text-[#6B6275]">
          {resendNote}
        </p>
      ) : null}
      <SubmitButton size="lg" className={submitClass} disabled={code.length !== length}>
        {copy.account.codeSubmit}
      </SubmitButton>
      <button type="button" onClick={onChangeEmail} className="text-sm font-medium text-[#6B6275] underline underline-offset-2 hover:text-[#2A2233]">
        {copy.account.changeEmail}
      </button>
    </form>
  );
}
