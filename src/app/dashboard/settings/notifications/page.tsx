import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { Card, PageHeader } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/states";
import { listNotificationTemplates } from "@/features/settings/queries";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, TEMPLATE_META } from "@/features/settings/notification-templates";
import { TemplateForm } from "@/features/dashboard-ui/forms";
import { getEmailPreferences } from "@/features/notifications/email/queries";
import { emailProviderConfigured } from "@/features/notifications/email/status";
import { EmailPreferencesForm } from "@/features/notifications/email/components/email-preferences-form";
import { WhatsAppNotificationsSection } from "./whatsapp-section";

export const metadata: Metadata = { title: "Notifications" };

function WhatsAppSectionFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading WhatsApp notification settings…</span>
      <Card title="WhatsApp" description="Loading your WhatsApp connection and templates…">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} title={<Skeleton className="h-4 w-32" />}>
            <Skeleton className="h-10 w-full rounded-lg" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function NotificationsPage() {
  const ctx = await requireTenantPermission("settings.write");
  const [saved, emailPrefs, providerConfigured] = await Promise.all([
    listNotificationTemplates(ctx.tenantId),
    getEmailPreferences(ctx.tenantId),
    emailProviderConfigured().catch(() => false),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Customer notifications" description="Order updates sent to shoppers by WhatsApp and email." />

      <Suspense fallback={<WhatsAppSectionFallback />}>
        <WhatsAppNotificationsSection tenantId={ctx.tenantId} />
      </Suspense>

      <h2 className="pt-2 text-h3 font-semibold">Email</h2>
      <p className="text-small text-muted">Emails sent to shoppers. Edit the wording; {"{{placeholders}}"} are filled in automatically.</p>
      <Card title="Which emails to send">
        <EmailPreferencesForm prefs={emailPrefs} providerConfigured={providerConfigured} />
      </Card>
      {TEMPLATE_KEYS.map((k) => {
        const s = saved.find((t) => t.key === k && t.channel === "email");
        const d = DEFAULT_TEMPLATES[k];
        return (
          <Card key={k} title={TEMPLATE_META[k].label} description={TEMPLATE_META[k].description}>
            <TemplateForm tkey={k} subject={s?.subject ?? d.subject} body={s?.body ?? d.body} active={s?.active ?? true} custom={Boolean(s)} variables={TEMPLATE_META[k].placeholders} />
          </Card>
        );
      })}
    </div>
  );
}
