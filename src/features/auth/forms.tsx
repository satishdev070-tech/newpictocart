"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction, verifyResetCodeAction } from "./actions";
import { EmailCodeFlow } from "@/components/auth/email-code-flow";

const forgotLink = (
  <Link href="/seller/forgot-password" className="text-small font-medium text-accent hover:underline">
    Forgot password?
  </Link>
);

const merchantSubmitClass = "w-full !bg-[#c2410c] !text-white hover:!bg-[#9a3412] focus-visible:!outline-[#c2410c]";

function PasswordGuidance({ value }: { value: string }) {
  const requirements = [
    { label: "10+ characters", met: value.length >= 10 },
    { label: "A letter", met: /[A-Za-z]/.test(value) },
    { label: "A number", met: /\d/.test(value) },
  ];
  const met = requirements.filter((requirement) => requirement.met).length;
  const summary = value.length === 0 ? "Use a unique password with these requirements." : met === requirements.length ? "Password meets the requirements." : "Keep going — complete all three checks.";

  return (
    <div className="mt-2 rounded-brand-sm border border-brand-orange/15 bg-brand-accent-soft/45 px-3 py-2.5 text-caption text-muted">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-brand-ink">Password strength</span>
        <span className={met === requirements.length ? "font-semibold text-success" : "text-muted"}>{summary}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1" aria-hidden>
        {requirements.map((requirement) => (
          <span key={requirement.label} className={`h-1 rounded-full ${requirement.met ? "bg-brand-orange-hover" : "bg-border"}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {requirements.map((requirement) => (
          <li key={requirement.label} className={requirement.met ? "font-medium text-success" : undefined}>
            {requirement.met ? "✓" : "○"} {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `variant="admin"` is the platform console: no self-serve sign-up link. */
export function SignInForm({ next, variant = "seller" }: { next?: string; variant?: "seller" | "admin" }) {
  const [state, action] = useActionState(signInAction, null);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <TextField label={variant === "admin" ? "Work email" : "Email"} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@company.com" required errors={errors.email} />
      <PasswordField label="Password" name="password" autoComplete="current-password" required errors={errors.password} labelAside={forgotLink} hint={variant === "seller" ? "Use the password for this merchant account." : undefined} />
      <SubmitButton size="lg" variant={variant === "admin" ? "accent" : "primary"} className={merchantSubmitClass}>
        Sign in
      </SubmitButton>
      {variant === "seller" ? (
        <p className="text-center text-small text-muted">
          New to the platform?{" "}
          <Link href={next ? `/seller/register?next=${encodeURIComponent(next)}` : "/seller/register"} className="font-medium text-foreground underline-offset-2 hover:underline">
            Create a merchant account
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function SignUpForm({
  next,
  defaultStoreName,
  plan,
  theme,
  lang,
  intent,
}: {
  next?: string;
  defaultStoreName?: string;
  plan?: string | null;
  theme?: string | null;
  lang?: string | null;
  intent?: string | null;
}) {
  const [state, action] = useActionState(signUpAction, null);
  const [password, setPassword] = useState("");
  const errors = fieldErrors(state);
  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div role="status" className="space-y-3 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
          <MailCheck aria-hidden className="size-5" />
        </span>
        <h2 className="text-h2">Check your email</h2>
        <p className="text-body text-muted">We sent a confirmation link to your email. Open it on this device to continue setting up your store; your choices are saved.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {theme ? <input type="hidden" name="theme" value={theme} /> : null}
      {lang ? <input type="hidden" name="lang" value={lang} /> : null}
      {intent ? <input type="hidden" name="intent" value={intent} /> : null}
      <FormMessage state={state} />
      <TextField label="Full name" name="displayName" autoComplete="name" placeholder="Asha Mehta" required errors={errors.displayName} />
      <TextField label="Email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@yourbusiness.in" required errors={errors.email} />
      <PasswordField label="Password" name="password" autoComplete="new-password" required errors={errors.password} onChange={(event) => setPassword(event.currentTarget.value)} hint={<PasswordGuidance value={password} />} />
      <TextField label="Business name" name="storeName" autoComplete="organization" placeholder="e.g. Asha Crafts" defaultValue={defaultStoreName} required errors={errors.storeName} hint="You'll confirm your store details in the next step." />
      <SubmitButton size="lg" className={merchantSubmitClass}>
        Create account
      </SubmitButton>
      <p className="text-caption text-muted">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="border-t border-border pt-5 text-center text-small text-muted">
        Already selling with us?{" "}
        <Link href="/seller/login" className="font-medium text-foreground underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Email → reset code (or the link in the same email) → choose a new password. */
export function ForgotPasswordForm() {
  return (
    <div className="space-y-4">
      <EmailCodeFlow requestAction={forgotPasswordAction} verifyAction={verifyResetCodeAction} emailLabel="Email" submitLabel="Send reset code" verifyLabel="Verify and set a new password" />
      <p className="text-center text-small">
        <Link href="/seller/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, null);
  const [password, setPassword] = useState("");
  const errors = fieldErrors(state);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} success={<><CheckCircle2 aria-hidden className="mr-1 inline size-4" /> Password updated.</>} />
      <PasswordField label="New password" name="password" autoComplete="new-password" required errors={errors.password} onChange={(event) => setPassword(event.currentTarget.value)} hint={<PasswordGuidance value={password} />} />
      <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" required errors={errors.confirm} hint="Re-enter the same password to confirm it." />
      <SubmitButton size="lg" className={merchantSubmitClass}>
        Update password
      </SubmitButton>
    </form>
  );
}
