"use client";

import { SelectField, TextAreaField } from "@/components/ui/field";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "../schemas";
import { updateEnquiryAction } from "../actions";
import { ActionForm } from "./ui";

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = { NEW: "New", CONTACTED: "Contacted", CONVERTED: "Converted", CLOSED: "Closed" };

/** Status + private notes for one lead (never shown to the visitor). */
export function EnquiryUpdateForm({ id, status, notes }: { id: string; status: EnquiryStatus; notes: string | null }) {
  return (
    <ActionForm action={updateEnquiryAction} submitLabel="Save" className="space-y-4">
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <SelectField label="Status" name="status" defaultValue={status} options={ENQUIRY_STATUSES.map((s) => ({ value: s, label: ENQUIRY_STATUS_LABELS[s] }))} errors={e.status} />
          <TextAreaField label="Private notes" name="notes" defaultValue={notes ?? ""} rows={4} maxLength={5000} optional errors={e.notes} hint="Only your team sees these." />
        </>
      )}
    </ActionForm>
  );
}
