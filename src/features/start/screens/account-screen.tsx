"use client";

import { useState } from "react";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { SignInForm, SignUpForm } from "@/features/auth/forms";
import { googleSignInAction } from "@/features/auth/actions";
import { startCopy } from "../copy";
import type { StartDraft } from "../draft/schema";
import { LivePreview } from "../components/live-preview";
import { draftStoreName } from "../draft/schema";

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
              <OrDivider />
            </>
          ) : null}
          {tab === "signup" ? (
            <SignUpForm
              next="/start"
              defaultStoreName={storeName}
              plan={draft.plan}
              theme={draft.theme}
              lang={draft.locale}
              intent={draft.intent}
            />
          ) : (
            <SignInForm next="/start" />
          )}
        </div>
      </div>
      <div className="hidden lg:block">
        <LivePreview locale={draft.locale} host={host ?? (draft.result ? `${draft.result.slug}.${rootDomain}` : null)} />
      </div>
    </>
  );
}
