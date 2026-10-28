import Link from "next/link";
import { Card } from "@/components/ui/layout";
import { getBellData, type InboxAudience } from "../server";
import { NotificationList } from "./notification-list";

/** Dashboard overview: latest notifications — same cached getBellData read as the layout bell. */
export async function RecentActivityCard({ audience, href }: { audience: InboxAudience; href: string }) {
  const { items } = await getBellData(audience);
  const shown = items.slice(0, 6);
  return (
    <Card
      title="Recent activity"
      actions={
        <Link href={href} className="text-sm font-medium text-accent hover:underline">
          View all
        </Link>
      }
    >
      {shown.length ? (
        <div className="-m-4 sm:-m-5">
          <NotificationList scope={audience.scope} userId={audience.userId} items={shown} live={false} />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">New orders, payments, reviews and stock alerts will appear here.</p>
      )}
    </Card>
  );
}
