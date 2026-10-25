"use client";

import { useActionState } from "react";
import { formatMoney } from "@/lib/money";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { ActionDialog } from "@/features/settings/ui/action-controls";
import { generateCommissionInvoicesAction, markCommissionInvoicePaidAction, waiveCommissionInvoiceAction } from "../actions";

/** "Run invoice generation now": month picker + the created count / total from the last run. */
export function GenerateInvoicesForm({ defaultMonth, maxMonth }: { defaultMonth: string; maxMonth: string }) {
  const [state, action] = useActionState(generateCommissionInvoicesAction, null);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="Month" name="period" type="month" defaultValue={defaultMonth} max={maxMonth} required errors={errors.period} className="w-48" />
        <SubmitButton size="sm" className="mb-0.5">
          Run invoice generation now
        </SubmitButton>
      </div>
      <FormMessage
        state={state}
        success={
          state?.ok
            ? state.data.created
              ? `${state.data.created} invoice${state.data.created === 1 ? "" : "s"} created for ${state.data.period}, totalling ${formatMoney(state.data.totalMinor)}.`
              : `No new invoices for ${state.data.period}: every store with GMV already has one, or no store had commissionable GMV.`
            : null
        }
      />
    </form>
  );
}

export function MarkInvoicePaidButton({ invoiceId, invoiceNumber, amount }: { invoiceId: string; invoiceNumber: string; amount: string }) {
  return (
    <ActionDialog
      action={markCommissionInvoicePaidAction}
      fields={{ invoiceId }}
      title={`Mark ${invoiceNumber} paid?`}
      description={`Records ${amount} as collected. This can't be undone.`}
      triggerLabel="Mark paid"
      confirmLabel="Mark paid"
      success="Invoice marked paid."
    >
      {(e) => <TextField label="Payment reference" name="reference" optional maxLength={160} hint="UTR, cheque or transaction ID" errors={e.reference} />}
    </ActionDialog>
  );
}

export function WaiveInvoiceButton({ invoiceId, invoiceNumber, amount }: { invoiceId: string; invoiceNumber: string; amount: string }) {
  return (
    <ActionDialog
      action={waiveCommissionInvoiceAction}
      fields={{ invoiceId }}
      title={`Waive ${invoiceNumber}?`}
      description={`${amount} will not be collected. The reason is kept in the audit log.`}
      triggerLabel="Waive"
      confirmLabel="Waive invoice"
      variant="danger"
      success="Invoice waived."
    >
      {(e) => <TextAreaField label="Reason" name="reason" required minLength={3} maxLength={500} rows={3} errors={e.reason} />}
    </ActionDialog>
  );
}
