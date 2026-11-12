import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { PublishForm } from "@/features/informative/panel/publish-form";
import { CloseSiteForm, NotificationForm, SiteOptionsForm } from "@/features/informative/panel/site-forms";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getNotificationSettings, getSite } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Settings" };

export default async function InformativeSettingsPage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("settings.write")) redirect("/informative/dashboard");
  const [site, notify] = await Promise.all([getSite(ctx), getNotificationSettings(ctx)]);
  if (!site) redirect("/informative/dashboard");
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card title="Enquiry notifications"><NotificationForm value={notify} /></Card>
        <Card title="Enquiry form"><SiteOptionsForm site={site} /></Card>
        {ctx.permissions.has("theme.publish") ? (
          <Card title="Visibility" description={site.status === "PUBLISHED" ? "Your website is live." : "Your website is a private draft."}>
            <PublishForm status={site.status} />
          </Card>
        ) : null}
        {ctx.role === "owner" ? (
          <Card title="Delete website" description="Takes your website offline and removes it from your account. Nothing is erased: support can restore it if you change your mind.">
            <CloseSiteForm slug={ctx.tenantSlug} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
