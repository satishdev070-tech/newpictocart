"use client";

import { ActionForm, InlineAction } from "@/features/settings/ui/action-controls";
import { SelectField, TextField } from "@/components/ui/field";
import { addTeamCallDayAction, deleteTeamCallSlotAction, saveTeamCallSlotAction, updateTeamCallBookingAction } from "../actions";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, type BookingStatus } from "../schemas";

/** Super Admin → Team calls: add a day of slots (IST). */
export function AddDaySlotsForm({ defaultDay }: { defaultDay: string }) {
  return (
    <ActionForm action={addTeamCallDayAction} submitLabel="Add slots" success="Slots added." className="space-y-4">
      {(e) => (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <TextField label="Day" name="day" type="date" defaultValue={defaultDay} required errors={e.day} className="col-span-2 sm:col-span-1" />
          <TextField label="From (IST)" name="from" type="time" defaultValue="10:00" required errors={e.from} />
          <TextField label="To (IST)" name="to" type="time" defaultValue="18:00" required errors={e.to} />
          <TextField label="Every (min)" name="every" type="number" min={10} max={240} defaultValue={30} errors={e.every} />
          <TextField label="Length (min)" name="durationMinutes" type="number" min={10} max={180} defaultValue={30} errors={e.durationMinutes} />
          <TextField label="Seats" name="capacity" type="number" min={1} max={20} defaultValue={1} errors={e.capacity} />
        </div>
      )}
    </ActionForm>
  );
}

/** One slot at a specific time. */
export function AddSlotForm() {
  return (
    <ActionForm action={saveTeamCallSlotAction} submitLabel="Add slot" success="Slot added." resetOnSuccess className="space-y-4">
      {(e) => (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField label="Starts (IST)" name="startsAt" type="datetime-local" required errors={e.startsAt} className="col-span-2" />
          <TextField label="Length (min)" name="durationMinutes" type="number" min={10} max={180} defaultValue={30} errors={e.durationMinutes} />
          <TextField label="Seats" name="capacity" type="number" min={1} max={20} defaultValue={1} errors={e.capacity} />
          <TextField label="Note (staff only)" name="note" maxLength={200} optional className="col-span-2 sm:col-span-4" />
        </div>
      )}
    </ActionForm>
  );
}

export function DeleteSlotButton({ id, booked }: { id: string; booked: number }) {
  return <InlineAction action={deleteTeamCallSlotAction} fields={{ id }} label={booked ? "Turn off" : "Delete"} success={booked ? "Slot turned off." : "Slot deleted."} variant="ghost" className="inline-flex" />;
}

export function BookingStatusForm({ id, status, adminNote }: { id: string; status: BookingStatus; adminNote: string | null }) {
  return (
    <ActionForm action={updateTeamCallBookingAction} fields={{ id }} submitLabel="Update" success="Booking updated." submitVariant="secondary" className="space-y-2">
      {(e) => (
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <SelectField label="Status" name="status" defaultValue={status} options={BOOKING_STATUSES.map((s) => ({ value: s, label: BOOKING_STATUS_LABEL[s] }))} errors={e.status} />
          <TextField label="Note (shown to the merchant)" name="adminNote" defaultValue={adminNote ?? ""} maxLength={1000} optional placeholder="e.g. Meet link or what we'll cover" errors={e.adminNote} />
        </div>
      )}
    </ActionForm>
  );
}
