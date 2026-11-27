import type { Metadata } from "next";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { InlineAction } from "@/features/settings/ui/action-controls";
import { getOwnProfile } from "@/features/account/server";
import { listMyBookings, listOpenSlots } from "@/features/team-calls/server";
import { BookCallForm } from "@/features/team-calls/components/book-call-form";
import { cancelMyTeamCallAction } from "@/features/team-calls/actions";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, formatCallWhen } from "@/features/team-calls/schemas";
import { formatPhone } from "@/lib/validation/phone";

export const metadata: Metadata = { title: "Book a free call" };

export default async function BookCallPage() {
  const ctx = await requireTenantPermission("store.read");
  const [slots, mine, profile] = await Promise.all([listOpenSlots(), listMyBookings(), getOwnProfile(ctx.user.id)]);
  const now = new Date().toISOString();
  const upcoming = mine.bookings.filter((b) => b.startsAt && b.startsAt >= now && (b.status === "requested" || b.status === "confirmed"));
  return (
    <div className="space-y-6">
      <PageHeader title="Book a free call with our team" description="A Pictocart expert calls you to help set up your store, payments, products or marketing. Free for every merchant." />
      {upcoming.length ? (
        <Card title="Your upcoming calls">
          <ul className="divide-y divide-border">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{b.startsAt ? formatCallWhen(b.startsAt) : "—"}</p>
                  <p className="text-caption text-muted">
                    We&apos;ll call {formatPhone(b.phone)}
                    {b.adminNote ? ` · ${b.adminNote}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  <InlineAction action={cancelMyTeamCallAction} fields={{ bookingId: b.id }} label="Cancel" success="Call cancelled." className="inline-flex" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card title={upcoming.length ? "Book another call" : "Pick a time that suits you"}>
        {slots.available ? (
          <BookCallForm mode="dashboard" slots={slots.slots} defaults={{ name: profile.displayName ?? ctx.user.displayName, phone: profile.phone }} />
        ) : (
          <p className="text-small text-muted">Booking opens soon. Please check back later.</p>
        )}
      </Card>
    </div>
  );
}
