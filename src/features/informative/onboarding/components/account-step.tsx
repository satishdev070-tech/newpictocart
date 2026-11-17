"use client";

import { EmailCodeFlow } from "@/components/auth/email-code-flow";
import { GoogleButton } from "@/components/auth/google-button";
import { googleSignInAction, requestStartEmailCodeAction, verifyStartEmailCodeAction } from "@/features/auth/actions";
import { OnbEyebrow, OnbHeading, OnbSub } from "@/components/onboarding-ui";
import { ui } from "./shell";
import { infoCopy } from "@/features/start/i18n/info-copy";

const FINISH = "/start/informative/finish";

/**
 * Informative Step 4 — reuses the existing account creation (Google, or the emailed one-time code
 * the store journey uses), returning to the finish step, which creates the site in small resumable
 * phases (onboarding/phases.ts). Signed-in people skip straight to finishing.
 */
export function AccountStep({ locale = "en-IN", signedIn, googleAvailable, businessName, onBack, onFinish }: { locale?: string; signedIn: boolean; googleAvailable: boolean; businessName: string; onBack: () => void; onFinish: () => void }) {
  const c = infoCopy(locale);
  const tx = c.account;
  return (
    <section className="flex flex-col gap-6" aria-labelledby="account-title">
      <div className="flex flex-col gap-3">
        <OnbEyebrow>{tx.eyebrow}</OnbEyebrow>
        <div id="account-title">
          <OnbHeading>{signedIn ? tx.titleSignedIn : tx.title}</OnbHeading>
        </div>
        <OnbSub>{signedIn ? tx.subSignedIn : tx.sub}</OnbSub>
      </div>
      <div className={`${ui.card} flex flex-col gap-5`}>
        {signedIn ? (
          <button type="button" onClick={onFinish} className={ui.primaryBtn}>{tx.create}</button>
        ) : (
          <>
            {googleAvailable ? (
              <>
                <GoogleButton action={googleSignInAction} next={FINISH} label={tx.google} className="[&_button]:min-h-12 [&_button]:!rounded-full" />
                <p className="flex items-center gap-3 font-mk-mono text-[11px] tracking-[0.18em] text-mk-dim uppercase" role="separator">
                  <span className="h-px flex-1 bg-mk-line" />{tx.or}<span className="h-px flex-1 bg-mk-line" />
                </p>
              </>
            ) : null}
            <EmailCodeFlow
              requestAction={requestStartEmailCodeAction}
              verifyAction={verifyStartEmailCodeAction}
              hidden={{ next: FINISH, type: "email", storeName: businessName }}
              submitLabel={tx.emailCode}
              verifyLabel={tx.verify}
            />
            <p className="text-center text-xs text-mk-dim">
              {tx.agree} <a className="text-mk-muted underline underline-offset-2 hover:text-mk-text" href="/terms">{tx.terms}</a> {tx.and} <a className="text-mk-muted underline underline-offset-2 hover:text-mk-text" href="/privacy">{tx.privacy}</a>.
            </p>
          </>
        )}
      </div>
      <div>
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← {c.back}</button>
      </div>
    </section>
  );
}
