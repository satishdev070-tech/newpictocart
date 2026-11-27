import Link from "next/link";
import { CheckCircle2, Gift, Mail, MessageCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/validation/phone";
import { InlineAction } from "@/features/settings/ui/action-controls";
import { claimVerificationBonusAction, resendEmailConfirmationAction } from "../actions";
import { VERIFICATION_BONUS_CREDITS, missingStep, type VerificationStatus } from "../schemas";

const VERIFY_HREF = "/dashboard/profile#verify";

function StepRow({ icon, label, detail, ok }: { icon: React.ReactNode; label: string; detail: string; ok: boolean }) {
  return (
    <li className={cn("flex min-h-11 min-w-0 items-center gap-3 rounded-lg border p-3", ok ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10")}>
      <span aria-hidden className="shrink-0 text-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-medium">{label}</span>
        <span className="block truncate text-caption text-muted">{detail}</span>
      </span>
      {ok ? (
        <span className="flex shrink-0 items-center gap-1 text-caption font-medium text-success">
          <CheckCircle2 aria-hidden className="size-4" /> Verified
        </span>
      ) : (
        <Link href={VERIFY_HREF} className={buttonClass({ size: "sm", className: "min-h-11 shrink-0" })}>
          <XCircle aria-hidden /> Verify
        </Link>
      )}
    </li>
  );
}

/** Dashboard home: "Claim 250 free AI credits" (store owner, until claimed). */
export function ClaimBonusCard({ status }: { status: VerificationStatus }) {
  const missing = missingStep(status);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Gift aria-hidden className="size-4 text-accent" /> Claim {VERIFICATION_BONUS_CREDITS} free AI credits
        </span>
      }
      description="Verify your email and your WhatsApp number to get free AI credits for product photos, descriptions and posts. One time, per person."
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StepRow icon={<Mail />} label="Email" detail={status.email ?? "No email on your account"} ok={status.emailVerified} />
        <StepRow icon={<MessageCircle />} label="WhatsApp number" detail={status.phoneVerified ? formatPhone(status.phone) : "Get a 6-digit code on WhatsApp"} ok={status.phoneVerified} />
      </ul>
      <div className="mt-4">
        {missing ? (
          <p className="text-small text-muted">
            {missing === "both" ? "Two quick steps left." : missing === "email" ? "Only your email is left." : "Only your WhatsApp number is left."}{" "}
            <Link href={VERIFY_HREF} className="font-medium text-accent hover:underline">
              Finish on My Profile
            </Link>
          </p>
        ) : (
          <InlineAction action={claimVerificationBonusAction} label={`Claim ${VERIFICATION_BONUS_CREDITS} credits`} variant="primary" size="lg" success="Credits added to your AI wallet." className="flex flex-col items-stretch gap-1 sm:items-start [&_button]:min-h-11" />
        )}
      </div>
    </Card>
  );
}

/** My Profile → email row: verified, or how to verify (resend the confirmation link). */
export function EmailVerificationRow({ email, verified }: { email: string | null; verified: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-small", verified ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10")}>
      <p className="flex min-w-0 items-center gap-2">
        {verified ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" /> : <Mail aria-hidden className="size-5 shrink-0 text-warning" />}
        <span className="min-w-0">
          <span className={cn("block font-semibold", verified ? "text-success" : "")}>{verified ? "Email verified" : "Email not verified yet"}</span>
          <span className="block truncate text-muted">{email ?? "No email on your account"}</span>
          {verified ? null : <span className="block text-caption text-muted">Open the confirmation link we emailed you when you signed up (check spam too), or send a new one.</span>}
        </span>
      </p>
      {verified || !email ? null : <InlineAction action={resendEmailConfirmationAction} label="Send confirmation link" success="Sent. Open the link in the email to verify." className="inline-flex flex-col items-start gap-1 [&_button]:min-h-11" />}
    </div>
  );
}
