import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import type { PlatformPermission } from "@/lib/permissions/matrix";
import { NotificationsPage } from "@/features/notifications/inbox/components/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const ctx = await requirePlatform();
  return (
    <NotificationsPage
      audience={{ userId: ctx.user.id, scope: "platform", tenantId: null }}
      sp={await searchParams}
      basePath="/admin/notifications"
      can={(p) => ctx.permissions.has(p as PlatformPermission)}
      description="Sign-ups, new and published stores, and plan requests across the platform."
    />
  );
}
