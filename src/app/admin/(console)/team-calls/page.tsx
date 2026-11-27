import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { formatPhone } from "@/lib/validation/phone";
import { listAdminTeamCalls } from "@/features/team-calls/server";
import { AddDaySlotsForm, AddSlotForm, BookingStatusForm, DeleteSlotButton } from "@/features/team-calls/components/admin-forms";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, bookingFilterSchema, formatCallTime, formatCallWhen, groupSlotsByDay, tomorrowIstDay } from "@/features/team-calls/schemas";

export const metadata: Metadata = { title: "Team calls" };

const chip = (on: boolean) => `inline-flex min-h-9 items-center rounded-full border px-3 text-small ${on ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-secondary"}`;

export default async function TeamCallsAdminPage({ searchParams }: PageProps<"/admin/team-calls">) {
  await requirePlatform("platform.users.manage");
  const f = bookingFilterSchema.parse(await searchParams);
  const data = await listAdminTeamCalls(f);
  const tomorrow = tomorrowIstDay();
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: f.status, when: f.when === "upcoming" ? undefined : f.when, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  // Slot groups for admin show full slots too (seatsLeft only drives the label).
  const days = groupSlotsByDay(data.slots.map((s) => ({ id: s.id, startsAt: s.startsAt, durationMinutes: s.durationMinutes, seatsLeft: 1 })));
  const slotById = new Map(data.slots.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <PageHeader title="Team calls" description="Free calls merchants and visitors book with our team (dashboard and the /book-call page). Add the times you can take calls; bookings appear below." />
      {!data.available ? <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">Team calls need migration 20261127009100_team_calls.sql.</p> : null}

      <Card title="Bookings">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["upcoming", "past", "all"] as const).map((w) => (
            <Link key={w} href={qs({ when: w === "upcoming" ? undefined : w })} className={chip(f.when === w)}>
              {w === "upcoming" ? "Upcoming" : w === "past" ? "Past" : "All"}
            </Link>
          ))}
          <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
          <Link href={qs({ status: undefined })} className={chip(!f.status)}>
            Any status
          </Link>
          {BOOKING_STATUSES.map((s) => (
            <Link key={s} href={qs({ status: s })} className={chip(f.status === s)}>
              {BOOKING_STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
        {data.bookings.length === 0 ? (
          <EmptyState title="No bookings" description="Bookings from the dashboard and the public page show up here." />
        ) : (
          <ul className="space-y-3">
            {data.bookings.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{b.startsAt ? formatCallWhen(b.startsAt) : "—"}</p>
                    <p className="text-small">
                      {b.name} ·{" "}
                      <a href={`tel:${b.phone}`} className="font-medium text-accent hover:underline">
                        {formatPhone(b.phone)}
                      </a>
                      {b.email ? <span className="text-muted"> · {b.email}</span> : null}
                    </p>
                    <p className="text-caption text-muted">
                      {b.source === "landing" ? "Website visitor" : b.tenantName ? `Merchant · ${b.tenantName}` : "Merchant"}
                      {b.tenantId ? (
                        <>
                          {" · "}
                          <Link href={`/admin/tenants/${b.tenantId}`} className="hover:underline">
                            Open store
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {b.topic ? <p className="mt-1 text-small text-muted">“{b.topic}”</p> : null}
                  </div>
                  <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <BookingStatusForm id={b.id} status={b.status} adminNote={b.adminNote} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Add a day of slots" description="Creates a slot every N minutes between the two times (IST). Existing times are skipped.">
          <AddDaySlotsForm defaultDay={tomorrow} />
        </Card>
        <Card title="Add one slot">
          <AddSlotForm />
        </Card>
      </div>

      <Card title="Slots" description="Upcoming times. A slot with bookings can only be turned off, not deleted.">
        {days.length === 0 ? (
          <p className="text-small text-muted">No upcoming slots. Add some above so people can book.</p>
        ) : (
          <div className="space-y-4">
            {days.map((d) => (
              <div key={d.day}>
                <p className="mb-2 text-label font-medium">{d.label}</p>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {d.slots.map((s) => {
                    const slot = slotById.get(s.id)!;
                    return (
                      <li key={s.id} className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 py-1.5 ${slot.active ? "border-border" : "border-dashed border-border opacity-60"}`}>
                        <span className="min-w-0">
                          <span className="font-medium tabular-nums">{formatCallTime(slot.startsAt)}</span>
                          <span className="ml-2 text-caption text-muted">
                            {slot.booked}/{slot.capacity} booked · {slot.durationMinutes} min{slot.active ? "" : " · off"}
                          </span>
                          {slot.note ? <span className="block truncate text-caption text-muted">{slot.note}</span> : null}
                        </span>
                        {slot.active ? <DeleteSlotButton id={slot.id} booked={slot.booked} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
