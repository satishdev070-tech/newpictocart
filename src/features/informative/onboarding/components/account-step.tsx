"use client";

import { EmailCodeFlow } from "@/components/auth/email-code-flow";
import { GoogleButton } from "@/components/auth/google-button";
import { googleSignInAction, requestStartEmailCodeAction, verifyStartEmailCodeAction } from "@/features/auth/actions";
import { OnbEyebrow, OnbHeading, OnbSub } from "@/components/onboarding-ui";
import { ui } from "./shell";

const FINISH = "/start/informative/finish";

/**
 * Informative Step 4 — reuses the existing account creation (Google, or the emailed one-time code
 * the store journey uses), returning to the finish step, which completes onboarding in one
 * transaction. Signed-in people skip straight to finishing.
 */
export function AccountStep({ signedIn, googleAvailable, businessName, onBack, onFinish }: { signedIn: boolean; googleAvailable: boolean; businessName: string; onBack: () => void; onFinish: () => void }) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="account-title">
      <div className="flex flex-col gap-3">
        <OnbEyebrow>Almost there</OnbEyebrow>
        <div id="account-title">
          <OnbHeading>{signedIn ? "Create your website" : "Create your account"}</OnbHeading>
        </div>
        <OnbSub>{signedIn ? "We'll set up your website as a private draft, with photos picked for your business. Publish it when you're ready." : "Your website is saved as a draft until you publish it."}</OnbSub>
      </div>
      <div className={`${ui.card} flex flex-col gap-5`}>
        {signedIn ? (
          <button type="button" onClick={onFinish} className={ui.primaryBtn}>Create my website</button>
        ) : (
          <>
            {googleAvailable ? (
              <>
                <GoogleButton action={googleSignInAction} next={FINISH} label="Continue with Google" className="[&_button]:min-h-12 [&_button]:!rounded-full" />
                <p className="flex items-center gap-3 font-mk-mono text-[11px] tracking-[0.18em] text-mk-dim uppercase" role="separator">
                  <span className="h-px flex-1 bg-mk-line" />or<span className="h-px flex-1 bg-mk-line" />
                </p>
              </>
            ) : null}
            <EmailCodeFlow
              requestAction={requestStartEmailCodeAction}
              verifyAction={verifyStartEmailCodeAction}
              hidden={{ next: FINISH, type: "email", storeName: businessName }}
              submitLabel="Email me a code"
              verifyLabel="Verify and create website"
            />
            <p className="text-center text-xs text-mk-dim">
              By continuing you agree to the <a className="text-mk-muted underline underline-offset-2 hover:text-mk-text" href="/terms">Terms</a> and <a className="text-mk-muted underline underline-offset-2 hover:text-mk-text" href="/privacy">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
      <div>
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← Back</button>
      </div>
    </section>
  );
}
