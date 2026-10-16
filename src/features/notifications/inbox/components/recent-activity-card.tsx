import Link from "next/link";
import { Card } from "@/components/ui/layout";
import { listNotifications, type InboxAudience } from "../server";
import { NotificationList } from "./notification-list";

/** Dashboard overview: the latest notifications for this member, fed by the same rows as the bell. */
export async function RecentActivityCard({ audience, href }: { audience: InboxAudience; href: string }) {
  const { items } = await listNotifications(audience, { status: "all", group: null, page: 1, pageSize: 6 }).catch(() => ({ items: [], total: 0 }));
  return (
    <Card
      title="Recent activity"
      actions={
        <Link href={href} className="text-sm font-medium text-accent hover:underline">
          View all
        </Link>
      }
    >
      {items.length ? (
        <div className="-m-4 sm:-m-5">
          <NotificationList scope={audience.scope} userId={audience.userId} items={items} live={false} />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">New orders, payments, reviews and stock alerts will appear here.</p>
      )}
    </Card>
  );
}
