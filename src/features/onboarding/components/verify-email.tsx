"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { resendOnboardingConfirmAction } from "../voice/actions";
import { StepHeading } from "./step-heading";

/** Shown when a password-signup seller reaches /onboarding before confirming email. */
export function VerifyEmailPanel({ email }: { email: string | null }) {
  const [state, action] = useActionState(resendOnboardingConfirmAction, null as Awaited<ReturnType<typeof resendOnboardingConfirmAction>> | null);
  return (
    <div className="space-y-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
        <MailCheck aria-hidden className="size-6" />
      </span>
      <StepHeading
        eyebrow="Confirm your email"
        title="Check your inbox"
        description={
          email
            ? `We sent a confirmation link to ${email}. Open it on this device to continue setting up your store.`
            : "We sent a confirmation link to your email. Open it on this device to continue setting up your store."
        }
      />
      <FormMessage state={state} success="Confirmation email sent again. Check your inbox." />
      <form action={action}>
        <SubmitButton variant="secondary">Resend confirmation email</SubmitButton>
      </form>
      <p className="text-sm text-muted">Already confirmed? Refresh this page.</p>
    </div>
  );
}
