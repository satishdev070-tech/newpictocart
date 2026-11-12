import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/layout";
import { ChangePasswordForm, ProfileForm } from "@/features/account/components";
import { getOwnProfile } from "@/features/account/server";
import { requireInformativeTenant } from "@/features/informative/server/context";

export const metadata: Metadata = { title: "My profile" };

/** Shared account page for Informative accounts (plan: profile/password stay shared; same actions). */
export default async function InformativeProfilePage() {
  const ctx = await requireInformativeTenant();
  const profile = await getOwnProfile(ctx.user.id);
  return (
    <>
      <PageHeader title="My profile" />
      <div className="space-y-6">
        <Card title="Personal details">
          <ProfileForm
            displayName={profile.displayName ?? ctx.user.displayName ?? ""}
            phone={profile.phone ?? ""}
            email={ctx.user.email ?? ""}
            labels={{ fullName: "Full name", phone: "Phone", email: "Email", emailLocked: "Contact support to change your email.", save: "Save", saved: "Saved." }}
          />
        </Card>
        <Card title="Password">
          <ChangePasswordForm labels={{ newPassword: "New password", confirmPassword: "Confirm password", update: "Update password", updated: "Password updated." }} />
        </Card>
      </div>
    </>
  );
}
