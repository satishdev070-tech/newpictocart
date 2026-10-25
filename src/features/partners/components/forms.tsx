"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ActionDialog, ActionForm, HiddenFields, InlineAction } from "@/features/settings/ui/action-controls";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatMoney, toDecimalString } from "@/lib/money";
import { PARTNER_TIERS, PARTNER_TYPES } from "@/features/platform-finance/calc";
import type { PartnerOption } from "../server";
import {
  acceptPartnerInviteAction,
  adjustPartnerCreditAction,
  attributeStoreAction,
  createLicenseRequestAction,
  createPartnerCodeAction,
  createPartnerDirectAction,
  decideLicenseRequestAction,
  invitePartnerAction,
  issueLicenseBatchAction,
  markBatchPaidAction,
  promotePartnerAction,
  redeemCodeForPartnerAction,
  removeDemoShopAction,
  revokeLicenseAction,
  revokePartnerCodeAction,
  runPayoutBatchAction,
  saveDemoShopAction,
  savePayoutDetailsAction,
  setAgencyPayoutAction,
  setDirectRateAction,
  setPartnerParentAction,
  setPartnerStatusAction,
  settlePayoutAction,
  toggleDemoShopAction,
  updatePartnerProfileAction,
} from "../actions";
import { LICENSE_TYPES, TIER_LABEL, TYPE_LABEL, INVITE_TTL_DAYS, maskAccount } from "../schemas";
import { CopyValue, ResultDialog } from "./result-dialog";

const TYPE_OPTS = PARTNER_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }));
const TIER_OPTS = PARTNER_TIERS.map((t) => ({ value: t, label: TIER_LABEL[t] }));
const LICENSE_OPTS = LICENSE_TYPES.map((t) => ({ value: t, label: t === "starter" ? "Starter plan" : "Growth plan" }));
const rupees = (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : toDecimalString(minor).replace(/\.00$/, ""));
const pct = (bps: number | null | undefined) => (bps === null || bps === undefined ? "" : String(bps / 100));

function ProfileFields({ e, d }: { e: Record<string, string[]>; d?: { name?: string; email?: string; phone?: string | null; companyName?: string | null; type?: string; city?: string | null; notes?: string | null } }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" name="name" required defaultValue={d?.name} errors={e.name} />
        <TextField label="Email" name="email" type="email" required defaultValue={d?.email} errors={e.email} />
        <TextField label="Phone" name="phone" optional inputMode="tel" defaultValue={d?.phone ?? ""} errors={e.phone} hint="10-digit mobile or +country number" />
        <TextField label="Company" name="companyName" optional defaultValue={d?.companyName ?? ""} errors={e.companyName} />
        <SelectField label="Type" name="partnerType" options={TYPE_OPTS} defaultValue={d?.type ?? "freelancer"} errors={e.partnerType} />
        <TextField label="City" name="city" optional defaultValue={d?.city ?? ""} errors={e.city} />
      </div>
      <TextAreaField label="Internal notes" name="notes" optional rows={2} defaultValue={d?.notes ?? ""} errors={e.notes} />
    </>
  );
}

// ---- Create / invite ----------------------------------------------------------------------

export function InvitePartnerButton() {
  return (
    <ResultDialog
      action={invitePartnerAction}
      title="Invite a partner"
      description={`Creates a pending partner and emails a one-time accept link (valid ${INVITE_TTL_DAYS} days). They sign in or sign up with this email, then accept.`}
      triggerLabel="Invite partner"
      confirmLabel="Create & send invite"
      wide
      result={(d) => (
        <div className="space-y-3">
          <p className="text-small">
            {d.emailStatus === "sent" ? "The invite email was sent." : d.emailStatus === "logged" ? "No email provider is configured, so the email was not delivered." : "The invite email could not be sent."} Share this link with the partner if needed. It is shown only once.
          </p>
          <CopyValue label="Accept link" value={d.link} />
          <Link href={`/admin/partners/${d.partnerId}`} className="text-small text-accent underline">
            Open the partner
          </Link>
        </div>
      )}
    >
      {(e) => (
        <>
          <ProfileFields e={e} />
          <SelectField label="Tier" name="tier" options={TIER_OPTS} defaultValue="partner" errors={e.tier} />
        </>
      )}
    </ResultDialog>
  );
}

export function CreatePartnerDirectButton() {
  return (
    <ResultDialog
      action={createPartnerDirectAction}
      title="Create partner directly"
      description="Creates a confirmed sign-in account with this password and an active partner linked to it. Share the password with the partner securely; it is never shown again."
      triggerLabel="Create partner directly"
      triggerVariant="secondary"
      confirmLabel="Create partner"
      wide
      result={(d) => (
        <div className="space-y-3">
          <p className="text-small">The account and partner were created.</p>
          <Link href={`/admin/partners/${d.partnerId}`} className="text-small text-accent underline">
            Open the partner
          </Link>
        </div>
      )}
    >
      {(e) => (
        <>
          <ProfileFields e={e} />
          <SelectField label="Tier" name="tier" options={TIER_OPTS} defaultValue="partner" errors={e.tier} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Password" name="password" type="password" autoComplete="new-password" required errors={e.password} hint="10+ characters with upper- and lower-case letters and a number" />
            <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" required errors={e.confirm} />
          </div>
        </>
      )}
    </ResultDialog>
  );
}

/** Active / suspended dropdown that saves on change (audited). Pending partners show until they accept. */
export function PartnerStatusSelect({ partnerId, status }: { partnerId: string; status: string }) {
  const [state, formAction] = useActionState(setPartnerStatusAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const { show } = useToast();
  useEffect(() => {
    if (state) show(state.ok ? { tone: "success", message: "Status updated." } : { tone: "error", message: state.error.fieldErrors?._form?.[0] ?? state.error.message });
  }, [state, show]);
  return (
    <form ref={formRef} action={formAction}>
      <HiddenFields fields={{ partnerId }} />
      <label className="sr-only" htmlFor={`status-${partnerId}`}>
        Status
      </label>
      <select id={`status-${partnerId}`} name="status" defaultValue={status === "pending" ? "" : status} onChange={() => formRef.current?.requestSubmit()} className="h-8 rounded-md border border-border bg-surface px-2 text-small">
        {status === "pending" ? (
          <option value="" disabled>
            Pending
          </option>
        ) : null}
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </form>
  );
}

// ---- Partner detail -------------------------------------------------------------------------

type ProfileData = { id: string; name: string; email: string; phone: string | null; companyName: string | null; type: string; city: string | null; notes: string | null; licensePriceMinor: number | null };

export function PartnerProfileForm({ p }: { p: ProfileData }) {
  return (
    <ActionForm action={updatePartnerProfileAction} fields={{ partnerId: p.id }} submitLabel="Save profile" success="Profile saved.">
      {(e) => (
        <>
          <ProfileFields e={e} d={p} />
          <TextField label="Default licence price (₹ per licence)" name="licensePrice" optional inputMode="decimal" defaultValue={rupees(p.licensePriceMinor)} errors={e.licensePrice} hint="Used when a licence request is approved without a price." className="sm:max-w-xs" />
        </>
      )}
    </ActionForm>
  );
}

type PayoutData = { id: string; payoutMethod: string | null; upiId: string | null; bankAccountHolder: string | null; bankLast4: string | null; bankIfsc: string | null; pan: string | null; gstin: string | null };

export function PayoutDetailsForm({ p }: { p: PayoutData }) {
  return (
    <ActionForm action={savePayoutDetailsAction} fields={{ partnerId: p.id }} submitLabel="Save payout details" success="Payout details saved.">
      {(e) => (
        <>
          <SelectField label="Payout method" name="payoutMethod" options={[{ value: "upi", label: "UPI" }, { value: "bank", label: "Bank transfer" }]} defaultValue={p.payoutMethod ?? "upi"} errors={e.payoutMethod} className="sm:max-w-xs" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="UPI ID" name="upiId" optional defaultValue={p.upiId ?? ""} placeholder="name@bank" errors={e.upiId} />
            <TextField label="Account holder" name="bankAccountHolder" optional defaultValue={p.bankAccountHolder ?? ""} errors={e.bankAccountHolder} />
            <TextField label="Account number" name="bankAccountNumber" optional inputMode="numeric" autoComplete="off" placeholder={p.bankLast4 ? `Saved: ${maskAccount(p.bankLast4)} (leave blank to keep)` : "6–20 digits"} errors={e.bankAccountNumber} />
            <TextField label="IFSC" name="bankIfsc" optional defaultValue={p.bankIfsc ?? ""} errors={e.bankIfsc} />
            <TextField label="PAN" name="pan" optional defaultValue={p.pan ?? ""} errors={e.pan} />
            <TextField label="GSTIN" name="gstin" optional defaultValue={p.gstin ?? ""} errors={e.gstin} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function PromoteForm({ p }: { p: { id: string; tier: string; overrideBps: number; stateName: string | null; regionName: string | null } }) {
  return (
    <ActionForm action={promotePartnerAction} fields={{ partnerId: p.id }} submitLabel="Save tier" success="Tier saved." className="space-y-3">
      {(e) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Tier" name="tier" options={TIER_OPTS} defaultValue={p.tier} errors={e.tier} />
          <TextField label="Override on team sales (%)" name="overridePercent" inputMode="decimal" required defaultValue={pct(p.overrideBps)} errors={e.overridePercent} />
          <TextField label="State" name="stateName" optional defaultValue={p.stateName ?? ""} errors={e.stateName} />
          <TextField label="Region" name="regionName" optional defaultValue={p.regionName ?? ""} errors={e.regionName} />
        </div>
      )}
    </ActionForm>
  );
}

export function ParentForm({ partnerId, parentId, options }: { partnerId: string; parentId: string | null; options: PartnerOption[] }) {
  const opts = [{ value: "", label: "No parent (reports to the platform)" }, ...options.map((o) => ({ value: o.id, label: `${o.name} · ${TYPE_LABEL[o.type as keyof typeof TYPE_LABEL] ?? o.type} · ${TIER_LABEL[o.tier as keyof typeof TIER_LABEL] ?? o.tier} (${o.code})` }))];
  return (
    <ActionForm action={setPartnerParentAction} fields={{ partnerId }} submitLabel="Save parent" success="Parent saved." className="space-y-3">
      {(e) => <SelectField label="Parent (agency or head)" name="parentId" options={opts} defaultValue={parentId ?? ""} errors={e.parentId} hint="The parent earns their override % on this partner's commissions." />}
    </ActionForm>
  );
}

export function DirectRateForm({ partnerId, directBps }: { partnerId: string; directBps: number }) {
  return (
    <ActionForm action={setDirectRateAction} fields={{ partnerId }} submitLabel="Save direct %" success="Direct rate saved." className="space-y-3">
      {(e) => <TextField label="Direct commission (%)" name="directPercent" inputMode="decimal" required defaultValue={pct(directBps)} errors={e.directPercent} hint="Monthly, on the plan price of each store this partner brought." className="sm:max-w-xs" />}
    </ActionForm>
  );
}

export function AgencyPayoutForm({ partnerId, agencyBps }: { partnerId: string; agencyBps: number | null }) {
  return (
    <ActionForm action={setAgencyPayoutAction} fields={{ partnerId }} submitLabel="Save & sync team" success="Agency payout saved and synced to the team." className="space-y-3">
      {(e) => <TextField label="Agency payout to agents and interns (%)" name="agencyPercent" inputMode="decimal" required defaultValue={pct(agencyBps)} errors={e.agencyPercent} hint="Sets the direct % of every agent and intern under this agency." className="sm:max-w-xs" />}
    </ActionForm>
  );
}

export function CreditForms({ partnerId }: { partnerId: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={adjustPartnerCreditAction} fields={{ partnerId }} submitLabel="Save credit" success="Credit updated." resetOnSuccess className="space-y-3">
        {(e) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Kind" name="kind" options={[{ value: "onboarding_credit", label: "Onboarding credit" }, { value: "adjustment", label: "Adjustment (+/−)" }]} errors={e.kind} />
              <TextField label="Amount (₹)" name="amount" inputMode="decimal" required placeholder="500 or -100" errors={e.amount} />
            </div>
            <TextField label="Reason" name="note" required errors={e.note} />
          </>
        )}
      </ActionForm>
      <ActionForm action={redeemCodeForPartnerAction} fields={{ partnerId }} submitLabel="Redeem code" success="Code redeemed and credit added." resetOnSuccess className="space-y-3">
        {(e) => <TextField label="Redeem a one-time code for this partner" name="code" required placeholder="OTC-XXXXXXXXXXXX" autoComplete="off" errors={e.code} hint="Credit is applied automatically to their next licence batch." />}
      </ActionForm>
    </div>
  );
}

export function IssueBatchForm({ partnerId, defaultPriceMinor, disabled }: { partnerId: string; defaultPriceMinor: number | null; disabled?: boolean }) {
  return (
    <ActionDialog
      action={issueLicenseBatchAction}
      fields={{ partnerId }}
      title="Issue a licence batch"
      description="Generates licence keys now. The partner's credit balance is applied to the batch first."
      triggerLabel="Issue batch"
      confirmLabel="Issue licences"
      disabled={disabled}
      success="Licences issued."
    >
      {(e) => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Plan" name="licenseType" options={LICENSE_OPTS} errors={e.licenseType} />
            <TextField label="Quantity" name="qty" type="number" min={1} max={10000} required defaultValue="10" errors={e.qty} />
            <TextField label="Unit price (₹)" name="unitPrice" inputMode="decimal" required defaultValue={rupees(defaultPriceMinor)} errors={e.unitPrice} />
          </div>
          <CheckboxField label="Already paid" name="paid" />
          <TextField label="Payment reference" name="reference" optional maxLength={160} errors={e.reference} />
        </>
      )}
    </ActionDialog>
  );
}

export function MarkBatchPaidButton({ batchId, partnerId, number, totalMinor }: { batchId: string; partnerId: string; number: string; totalMinor: number }) {
  return (
    <ActionDialog action={markBatchPaidAction} fields={{ batchId, partnerId }} title={`Mark ${number} paid?`} description={`Records ${formatMoney(totalMinor)} as received.`} triggerLabel="Mark paid" confirmLabel="Mark paid" success="Batch marked paid.">
      {(e) => <TextField label="Payment reference / UTR" name="reference" required maxLength={160} errors={e.reference} />}
    </ActionDialog>
  );
}

export function RevokeLicenseButton({ licenseId, partnerId, licenseKey }: { licenseId: string; partnerId?: string; licenseKey: string }) {
  return <ActionDialog action={revokeLicenseAction} fields={{ licenseId, ...(partnerId ? { partnerId } : {}) }} title={`Revoke ${licenseKey}?`} description="The key stops working. Only unused licences can be revoked." triggerLabel="Revoke" confirmLabel="Revoke licence" variant="danger" success="Licence revoked." />;
}

export function AttributeStoreForm({ partnerId }: { partnerId: string }) {
  return (
    <ActionForm action={attributeStoreAction} fields={{ partnerId }} submitLabel="Attribute store" success="Store attributed to this partner." resetOnSuccess className="flex flex-wrap items-end gap-3">
      {(e) => <TextField label="Store ID or slug" name="store" required placeholder="e.g. aangan" errors={e.store} className="min-w-64 flex-1" hint="Moves the store to this partner (replacing any previous attribution)." />}
    </ActionForm>
  );
}

export function RemoveAttributionButton({ partnerId, slug }: { partnerId: string; slug: string }) {
  return <InlineAction action={attributeStoreAction} fields={{ partnerId, store: slug, remove: "on" }} label="Remove" success="Attribution removed." />;
}

// ---- Licence requests ------------------------------------------------------------------------

export function LicenseRequestForm({ partners }: { partners: PartnerOption[] }) {
  const active = partners.filter((p) => p.status === "active");
  return (
    <ActionDialog action={createLicenseRequestAction} title="Request licences on a partner's behalf" description="The request joins the queue below for approval." triggerLabel="New request" confirmLabel="Create request" disabled={!active.length} success="Request created.">
      {(e) => (
        <>
          <SelectField label="Partner" name="partnerId" options={[{ value: "", label: "Choose a partner" }, ...active.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))]} errors={e.partnerId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Plan" name="licenseType" options={LICENSE_OPTS} errors={e.licenseType} />
            <TextField label="Quantity" name="qty" type="number" min={1} max={10000} required defaultValue="10" errors={e.qty} />
          </div>
          <TextAreaField label="Notes" name="notes" optional rows={2} errors={e.notes} />
        </>
      )}
    </ActionDialog>
  );
}

export function DecideRequestButtons({ requestId, qty, defaultPriceMinor }: { requestId: string; qty: number; defaultPriceMinor: number | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog action={decideLicenseRequestAction} fields={{ requestId, decision: "approve" }} title="Approve licence request?" description={`Issues ${qty} licence key${qty === 1 ? "" : "s"} now. The partner's credit is applied first.`} triggerLabel="Approve" confirmLabel="Approve & issue" success="Approved and licences issued.">
        {(e) => (
          <>
            <TextField label="Unit price (₹)" name="unitPrice" inputMode="decimal" defaultValue={rupees(defaultPriceMinor)} required={defaultPriceMinor === null} optional={defaultPriceMinor !== null} errors={e.unitPrice} />
            <CheckboxField label="Already paid" name="paid" />
            <TextField label="Payment reference" name="reference" optional maxLength={160} errors={e.reference} />
            <TextAreaField label="Note" name="note" optional rows={2} errors={e.note} />
          </>
        )}
      </ActionDialog>
      <ActionDialog action={decideLicenseRequestAction} fields={{ requestId, decision: "reject" }} title="Reject licence request?" triggerLabel="Reject" confirmLabel="Reject" variant="danger" success="Request rejected.">
        {(e) => <TextAreaField label="Reason" name="note" rows={2} required errors={e.note} />}
      </ActionDialog>
    </div>
  );
}

// ---- Demo shops and codes --------------------------------------------------------------------

export function DemoShopForm({ candidates }: { candidates: { id: string; name: string; slug: string }[] }) {
  return (
    <ActionForm action={saveDemoShopAction} submitLabel="Add demo shop" success="Demo shop added." resetOnSuccess className="space-y-3">
      {(e) => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Demo store" name="tenantId" options={[{ value: "", label: candidates.length ? "Choose a store" : "No unlisted demo stores" }, ...candidates.map((c) => ({ value: c.id, label: `${c.name} (${c.slug})` }))]} errors={e.tenantId} />
            <TextField label="Category" name="category" required placeholder="Fashion" errors={e.category} />
            <TextField label="Order" name="position" type="number" min={0} defaultValue="0" errors={e.position} />
          </div>
          <TextField label="Note for partners" name="note" optional maxLength={500} errors={e.note} />
          <CheckboxField label="Show to partners" name="active" defaultChecked />
        </>
      )}
    </ActionForm>
  );
}

export function DemoShopControls({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <InlineAction action={toggleDemoShopAction} fields={{ id, active: active ? "false" : "true" }} label={active ? "Hide" : "Show"} success={active ? "Hidden." : "Shown."} />
      <ActionDialog action={removeDemoShopAction} fields={{ id }} title="Remove this demo shop?" description="The store itself is not changed." triggerLabel="Remove" confirmLabel="Remove" variant="danger" success="Removed." />
    </div>
  );
}

export function CreateCodeButton() {
  return (
    <ResultDialog
      action={createPartnerCodeAction}
      title="Generate a one-time code"
      description="A partner (or you, on their behalf) redeems it for licence credit. Only a hash is stored, so the code is shown once."
      triggerLabel="Generate code"
      confirmLabel="Generate"
      result={(d) => (
        <div className="space-y-3">
          <CopyValue label="One-time code" value={d.code} />
          <p className="text-caption text-muted">Copy it now. It can&apos;t be shown again; revoke it and generate a new one if it&apos;s lost.</p>
        </div>
      )}
    >
      {(e) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Value (₹)" name="value" inputMode="decimal" required placeholder="500" errors={e.value} />
            <TextField label="Expires on" name="expiresAt" type="date" optional errors={e.expiresAt} />
          </div>
          <TextField label="Note" name="note" optional maxLength={200} errors={e.note} />
        </>
      )}
    </ResultDialog>
  );
}

export function RevokeCodeButton({ codeId, hint }: { codeId: string; hint: string }) {
  return <ActionDialog action={revokePartnerCodeAction} fields={{ codeId }} title={`Revoke code …${hint}?`} description="It can no longer be redeemed." triggerLabel="Revoke" confirmLabel="Revoke" variant="danger" success="Code revoked." />;
}

// ---- Payouts --------------------------------------------------------------------------------

export function RunPayoutBatchForm({ cutoff, today }: { cutoff: string; today: string }) {
  return (
    <ResultDialog
      action={runPayoutBatchAction}
      title="Run payout batch"
      description="Accrues the cutoff month (if it has ended), then creates one payout per partner for every pending commission up to the cutoff. Partners below the minimum roll over to the next batch."
      triggerLabel="Run batch"
      confirmLabel="Run batch"
      result={(d) => (
        <p className="text-small">
          {d.created ? `Created ${d.created} payout${d.created === 1 ? "" : "s"} totalling ${formatMoney(d.totalMinor)}.` : "No payouts were created."}
          {d.carriedOver ? ` ${d.carriedOver} partner${d.carriedOver === 1 ? "" : "s"} below the minimum rolled over.` : ""}
        </p>
      )}
    >
      {(e) => (
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Cutoff" name="cutoff" type="date" required max={today} defaultValue={cutoff} errors={e.cutoff} />
          <SelectField label="Method" name="method" options={[{ value: "upi", label: "UPI" }, { value: "bank", label: "Bank transfer" }, { value: "other", label: "Other" }]} errors={e.method} />
          <TextField label="Minimum (₹)" name="minAmount" inputMode="decimal" defaultValue="0" errors={e.minAmount} />
        </div>
      )}
    </ResultDialog>
  );
}

export function SettlePayoutButtons({ payoutId, amountMinor }: { payoutId: string; amountMinor: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog action={settlePayoutAction} fields={{ payoutId, outcome: "paid" }} title="Mark payout paid?" description={`Confirms ${formatMoney(amountMinor)} was transferred.`} triggerLabel="Mark paid" confirmLabel="Mark paid" success="Payout marked paid.">
        {(e) => (
          <>
            <TextField label="UTR / bank reference" name="utr" required autoComplete="off" errors={e.utr} />
            <TextAreaField label="Note" name="note" optional rows={2} errors={e.note} />
          </>
        )}
      </ActionDialog>
      <ActionDialog action={settlePayoutAction} fields={{ payoutId, outcome: "failed" }} title="Mark payout failed?" description="Its commissions go back to pending and are included in the next batch." triggerLabel="Mark failed" confirmLabel="Mark failed" variant="danger" success="Payout marked failed.">
        {(e) => <TextAreaField label="Reason" name="note" rows={2} required errors={e.note} />}
      </ActionDialog>
    </div>
  );
}

// ---- Invite acceptance ----------------------------------------------------------------------

export function AcceptPartnerInviteForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(acceptPartnerInviteAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
        You&apos;re now a partner. The platform team will be in touch about licences and payouts.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {state.error.fieldErrors?._form?.[0] ?? state.error.fieldErrors?.token?.[0] ?? state.error.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Accept invitation</SubmitButton>
    </form>
  );
}
