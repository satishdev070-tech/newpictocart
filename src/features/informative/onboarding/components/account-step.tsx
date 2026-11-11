"use client";

import { EmailCodeFlow } from "@/components/auth/email-code-flow";
import { GoogleButton } from "@/components/auth/google-button";
import { googleSignInAction, requestStartEmailCodeAction, verifyStartEmailCodeAction } from "@/features/auth/actions";
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
      <div>
        <h1 id="account-title" className="font-brand text-3xl sm:text-4xl">{signedIn ? "Create your website" : "Create your account"}</h1>
        <p className="mt-2 text-[#5E5568]">{signedIn ? "We'll set up your website as a private draft. Publish it when you're ready." : "Your website is saved as a draft until you publish it."}</p>
      </div>
      <div className={`${ui.card} flex flex-col gap-5`}>
        {signedIn ? (
          <button type="button" onClick={onFinish} className={ui.primaryBtn}>Create my website</button>
        ) : (
          <>
            {googleAvailable ? (
              <>
                <GoogleButton action={googleSignInAction} next={FINISH} label="Continue with Google" className="[&_button]:min-h-12 [&_button]:!rounded-full" />
                <p className="flex items-center gap-3 text-xs tracking-wider text-[#5E5568] uppercase" role="separator">
                  <span className="h-px flex-1 bg-[#2A2233]/15" />or<span className="h-px flex-1 bg-[#2A2233]/15" />
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
            <p className="text-center text-xs text-[#5E5568]">
              By continuing you agree to the <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.
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
