"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { EmailCodeFlow } from "@/components/auth/email-code-flow";
import { requestMerchantCodeAction, verifyMerchantCodeAction } from "./actions";
import { SignInForm } from "./forms";

/** Merchant sign-up: email → code → onboarding ("What are you building?"). */
export function MerchantSignUp({ next, plan, theme, lang, intent }: { next?: string; plan?: string | null; theme?: string | null; lang?: string | null; intent?: string | null }) {
  return (
    <EmailCodeFlow
      requestAction={requestMerchantCodeAction}
      verifyAction={verifyMerchantCodeAction}
      hidden={{ mode: "signup", next, plan, theme, lang, intent }}
      submitLabel="Create my store"
      verifyLabel="Verify and continue"
    />
  );
}

/** Merchant sign-in: email code by default, password for sellers who set one. */
export function MerchantSignIn({ next }: { next?: string }) {
  const [tab, setTab] = useState<"code" | "password">("code");
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 rounded-lg bg-surface-secondary p-1 text-sm font-medium">
        {(["code", "password"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("rounded-md px-3 py-1.5 transition", tab === t ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground")}
          >
            {t === "code" ? "Email me a code" : "Password"}
          </button>
        ))}
      </div>
      {tab === "code" ? (
        <EmailCodeFlow requestAction={requestMerchantCodeAction} verifyAction={verifyMerchantCodeAction} hidden={{ mode: "signin", next }} submitLabel="Send code" verifyLabel="Verify and sign in" />
      ) : (
        <SignInForm next={next} />
      )}
    </div>
  );
}
