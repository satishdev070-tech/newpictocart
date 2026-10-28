import Link from "next/link";
import { NotificationBell } from "@/features/notifications/inbox/components/notification-bell";
import { getBellData } from "@/features/notifications/inbox/server";
import { getMyActiveSupportSessions, getPlatformOverview } from "@/features/platform/server/queries";
import { Skeleton } from "@/components/ui/states";

/** Placeholder while the admin bell (+ overview attention chips) streams in. */
export function AdminTopbarChromeFallback() {
  return <Skeleton className="size-8 rounded-lg" />;
}

/**
 * Platform notification bell with attention chips from platform_overview. Streamed under Suspense
 * so the console shell and child routes are not blocked on overview / inbox reads.
 */
export async function AdminTopbarChrome({
  userId,
  canOverview,
}: {
  userId: string;
  canOverview: boolean;
}) {
  const [overview, bell] = await Promise.all([
    canOverview ? getPlatformOverview().catch(() => null) : Promise.resolve(null),
    getBellData({ userId, scope: "platform", tenantId: null }),
  ]);
  const alerts = overview
    ? [
        { key: "trials", label: "trials ending in 7 days", count: overview.trialsEnding7d, href: "/admin/tenants?status=trial" },
        { key: "domains", label: "custom domains awaiting verification", count: overview.customDomainsPending, href: "/admin/domains?status=pending" },
      ].filter((a) => a.count > 0)
    : [];

  return <NotificationBell scope="platform" userId={userId} initial={bell} attention={alerts} viewAllHref="/admin/notifications" />;
}

/** Active support-session strip. Streamed; returns null when none. */
export async function AdminSupportBanner({ userId }: { userId: string }) {
  const sessions = await getMyActiveSupportSessions(userId);
  if (!sessions.length) return null;
  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-small">
      Active support session{sessions.length > 1 ? "s" : ""}:{" "}
      {sessions.map((s, i) => (
        <span key={s.id}>
          {i ? ", " : ""}
          <Link href={`/admin/tenants/${s.tenantId}/support`} className="font-medium underline">
            {s.tenantName ?? "store"}
          </Link>
        </span>
      ))}
    </div>
  );
}
