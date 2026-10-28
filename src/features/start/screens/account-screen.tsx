"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { PasswordField } from "@/components/ui/password-field";
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
      <div className="flex flex-col gap-5">
        <h2 className="font-brand text-3xl">
          {c.account.title}
          <span className="text-[#C2410C]">{c.account.titleAccent}</span>
        </h2>
        <p className="text-sm text-[#5E5568]">{c.account.sub}</p>
        <dl className="grid gap-2 rounded-[20px] border border-white/90 bg-white/70 px-4 py-3 text-sm text-[#3F3A47] shadow-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#6B6275]">Store</dt>
            <dd className="font-medium text-right">{storeName}</dd>
          </div>
          {categoryLabel ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#6B6275]">Category</dt>
              <dd className="font-medium text-right">
                {categoryLabel}
                {subcategoryText ? ` · ${subcategoryText}` : ""}
              </dd>
            </div>
          ) : null}
          {draft.theme ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#6B6275]">Theme</dt>
              <dd className="font-medium text-right">{draft.theme}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[#6B6275]">Language</dt>
            <dd className="font-medium text-right">{draft.locale}</dd>
          </div>
        </dl>
        <div className="flex gap-2 rounded-full bg-white/60 p-1">
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={tab === "signup" ? "flex-1 rounded-full bg-white py-2 text-sm font-semibold shadow" : "flex-1 py-2 text-sm text-[#6B6275]"}
          >
            {c.account.signUp}
          </button>
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={tab === "signin" ? "flex-1 rounded-full bg-white py-2 text-sm font-semibold shadow" : "flex-1 py-2 text-sm text-[#6B6275]"}
          >
            {c.account.signIn}
          </button>
        </div>
        <div className="rounded-[28px] border border-white/90 bg-white/75 p-5 shadow-sm">
          {googleAvailable ? (
            <>
              <GoogleButton action={googleSignInAction} next="/start" label="Continue with Google" />
              <p className="my-4 text-center text-xs uppercase tracking-wider text-[#6B6275]" role="separator">
                {c.account.orEmail}
              </p>
            </>
          ) : null}
          {tab === "signup" ? (
            <StartSignUpForm copy={c} draft={draft} storeName={storeName} />
          ) : (
            <StartSignInForm copy={c} draft={draft} storeName={storeName} />
          )}
        </div>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} rootDomain={rootDomain} draft={draft} />
      </div>
    </>
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
  const [state, action] = useActionState(signUpAction, null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const errors = fieldErrors(state);
  if (state?.ok && state.data.needsConfirmation && email) {
    return <StartCodeForm copy={copy} email={email} type="signup" />;
  }
  if (codeEmail) {
    return <StartCodeForm copy={copy} email={codeEmail} type="email" />;
  }
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        {hiddenJourneyFields(draft, storeName)}
        <FormMessage state={state} />
        <TextField label={copy.account.name} name="displayName" autoComplete="name" required errors={errors.displayName} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label={copy.account.email} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required errors={errors.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField
          label={copy.account.password}
          name="password"
          autoComplete="new-password"
          required
          errors={errors.password}
          hint={copy.account.passwordHint}
        />
        <SubmitButton size="lg" className={submitClass}>
          {copy.account.create}
        </SubmitButton>
        <p className="text-caption text-muted">
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
      </form>
      <EmailCodeRequest copy={copy} draft={draft} storeName={storeName} email={email} displayName={name} onSent={setCodeEmail} />
    </div>
  );
}

function StartSignInForm({ copy, draft, storeName }: { copy: StartCopy; draft: StartDraft; storeName: string }) {
  const [state, action] = useActionState(signInAction, null);
  const [email, setEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const errors = fieldErrors(state);
  if (codeEmail) {
    return <StartCodeForm copy={copy} email={codeEmail} type="email" />;
  }
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value="/start" />
        <FormMessage state={state as ActionResult<unknown> | null} />
        <TextField label={copy.account.email} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required errors={errors.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label={copy.account.password} name="password" autoComplete="current-password" required errors={errors.password} />
        <SubmitButton size="lg" className={submitClass}>
          {copy.account.signInSubmit}
        </SubmitButton>
      </form>
      <EmailCodeRequest copy={copy} draft={draft} storeName={storeName} email={email} onSent={setCodeEmail} />
    </div>
  );
}

function EmailCodeRequest({
  copy,
  draft,
  storeName,
  email,
  displayName,
  onSent,
}: {
  copy: StartCopy;
  draft: StartDraft;
  storeName: string;
  email: string;
  displayName?: string;
  onSent: (email: string) => void;
}) {
  const [state, action] = useActionState(requestStartEmailCodeAction, null);
  useEffect(() => {
    if (state?.ok) onSent(state.data.email);
  }, [state, onSent]);
  return (
    <form action={action} className="space-y-2">
      {hiddenJourneyFields(draft, storeName)}
      <input type="hidden" name="email" value={email} />
      {displayName ? <input type="hidden" name="displayName" value={displayName} /> : null}
      <FormMessage state={state} />
      <SubmitButton size="md" variant="secondary" className="w-full" disabled={!email.trim()}>
        {copy.account.sendCode}
      </SubmitButton>
    </form>
  );
}

function StartCodeForm({ copy, email, type }: { copy: StartCopy; email: string; type: "signup" | "email" }) {
  const [state, action] = useActionState(verifyStartEmailCodeAction, null);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <p role="status" className="text-sm text-[#5E5568]">
        {copy.account.codeSent} {copy.account.checkEmail}
      </p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value="/start" />
      <FormMessage state={state} />
      <TextField
        label={copy.account.codeLabel}
        name="token"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        errors={errors.token}
        hint={copy.account.codeHint}
      />
      <SubmitButton size="lg" className={submitClass}>
        {copy.account.codeSubmit}
      </SubmitButton>
    </form>
  );
}
