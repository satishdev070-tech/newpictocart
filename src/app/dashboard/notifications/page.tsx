import type { Metadata } from "next";
import { can, requireTenant } from "@/lib/tenant/membership";
import { isTenantPermission } from "@/lib/permissions/matrix";
import { NotificationsPage } from "@/features/notifications/inbox/components/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default async function DashboardNotificationsPage({ searchParams }: PageProps<"/dashboard/notifications">) {
  const ctx = await requireTenant();
  return (
    <NotificationsPage
      audience={{ userId: ctx.user.id, scope: "tenant", tenantId: ctx.tenantId }}
      sp={await searchParams}
      basePath="/dashboard/notifications"
      can={(p) => isTenantPermission(p) && can(ctx, p)}
      description={`Orders, payments, stock and store alerts for ${ctx.tenantName}.`}
    />
  );
}
