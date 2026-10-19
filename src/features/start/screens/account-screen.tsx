"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { PasswordField } from "@/components/ui/password-field";
import { googleSignInAction, signInAction, signUpAction } from "@/features/auth/actions";
import type { ActionResult } from "@/lib/actions/result";
import { LivePreview } from "../components/live-preview";
import { startCopy, type StartCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { draftStoreName } from "../draft/schema";

const submitClass = "w-full !rounded-full !bg-[#F97316] !text-white hover:!bg-[#EA580C] focus-visible:!outline-[#F97316]";

export function AccountScreen({
  draft,
  rootDomain,
  googleAvailable,
  host,
}: {
  draft: StartDraft;
  rootDomain: string;
  googleAvailable: boolean;
  host: string | null;
}) {
  const c = startCopy(draft.locale);
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const storeName = draftStoreName(draft) || "My store";

  return (
    <>
      <div className="flex flex-col gap-5">
        <h2 className="font-brand text-3xl">
          {c.account.title}
          <span className="text-[#C2410C]">{c.account.titleAccent}</span>
        </h2>
        <p className="text-sm text-[#5E5568]">{c.account.sub}</p>
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
            <StartSignInForm copy={c} />
          )}
        </div>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} host={host ?? (draft.result ? `${draft.result.slug}.${rootDomain}` : null)} />
      </div>
    </>
  );
}

function StartSignUpForm({ copy, draft, storeName }: { copy: StartCopy; draft: StartDraft; storeName: string }) {
  const [state, action] = useActionState(signUpAction, null);
  const errors = fieldErrors(state);
  if (state?.ok && state.data.needsConfirmation) {
    return (
      <p role="status" className="text-sm text-[#5E5568]">
        {copy.account.checkEmail}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value="/start" />
      <input type="hidden" name="storeName" value={storeName} />
      {draft.plan ? <input type="hidden" name="plan" value={draft.plan} /> : null}
      {draft.theme ? <input type="hidden" name="theme" value={draft.theme} /> : null}
      <input type="hidden" name="lang" value={draft.locale} />
      {draft.intent ? <input type="hidden" name="intent" value={draft.intent} /> : null}
      <FormMessage state={state} />
      <TextField label={copy.account.name} name="displayName" autoComplete="name" required errors={errors.displayName} />
      <TextField label={copy.account.email} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required errors={errors.email} />
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
  );
}

function StartSignInForm({ copy }: { copy: StartCopy }) {
  const [state, action] = useActionState(signInAction, null);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value="/start" />
      <FormMessage state={state as ActionResult<unknown> | null} />
      <TextField label={copy.account.email} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required errors={errors.email} />
      <PasswordField label={copy.account.password} name="password" autoComplete="current-password" required errors={errors.password} />
      <SubmitButton size="lg" className={submitClass}>
        {copy.account.signInSubmit}
      </SubmitButton>
    </form>
  );
}
