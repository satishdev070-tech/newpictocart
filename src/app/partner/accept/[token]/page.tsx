import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PLATFORM_NAME } from "@/config/platform";
import { INVITE_TOKEN_RE } from "@/features/partners/schemas";
import { AcceptPartnerInviteForm } from "@/features/partners/components/forms";

export const metadata: Metadata = { title: "Partner invitation", robots: { index: false } };

export default async function AcceptPartnerInvitePage({ params }: PageProps<"/partner/accept/[token]">) {
  const { token } = await params;
  const valid = INVITE_TOKEN_RE.test(token);
  const user = await requireUser(`/partner/accept/${encodeURIComponent(token)}`);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="mb-1 text-lg font-semibold">Join the {PLATFORM_NAME} partner programme</h1>
        {valid ? (
          <>
            <p className="mb-5 text-sm text-muted">
              Accept to link your partner profile to this account ({user.email}). Use the same email address the invite was sent to.
            </p>
            <AcceptPartnerInviteForm token={token} />
          </>
        ) : (
          <p role="alert" className="mt-3 text-sm text-error">
            This invite link is not valid. Check that you copied the whole link, or ask the platform team for a new one.
          </p>
        )}
      </div>
    </main>
  );
}
