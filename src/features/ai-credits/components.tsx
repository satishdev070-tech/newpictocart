"use client";

import { formatMoney } from "@/lib/money";
import { Badge, Card } from "@/components/ui/layout";
import { ActionDialog, ActionForm } from "@/features/settings/ui/action-controls";
import { TextAreaField, TextField } from "@/components/ui/field";
import { AI_CREDIT_PACKS, type AiCreditLedgerRow, type AiCreditPurchaseRow } from "./schemas";
import { requestAiCreditPurchaseAction } from "./actions";
import { decideAiCreditPurchasePlatformAction, grantAiCreditsPlatformAction } from "./platform-actions";

const statusTone = { pending: "warning", approved: "success", declined: "error", cancelled: "neutral" } as const;

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

export function AiCreditSellerPanel({ available, balance, ledger, purchases, canManage }: { available: boolean; balance: number; ledger: AiCreditLedgerRow[]; purchases: AiCreditPurchaseRow[]; canManage: boolean }) {
  if (!available) return <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">AI credit accounting will activate when the pending database migration is applied. AI features keep working normally until then.</p>;
  const pending = purchases.find((p) => p.status === "pending");
  return (
    <div className="space-y-4">
      <Card title="AI credits" description="One credit is used for each AI generation. A failed AI call is refunded automatically.">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-3xl font-semibold tabular-nums">{balance}</p><p className="text-small text-muted">credits available</p></div>
          <p className="max-w-lg text-caption text-muted">Credits are shared by your store&apos;s AI writing and site-builder tools. They are not consumed when an AI provider fails.</p>
        </div>
      </Card>
      <Card title="Buy credits" description={pending ? "One purchase is already awaiting platform review." : "Choose a pack and payment method. Credits are added only after the payment is verified."}>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(AI_CREDIT_PACKS).map(([key, pack]) => (
            <div key={key} className="rounded-lg border border-border p-4">
              <p className="font-semibold">{pack.label}</p>
              <p className="mt-1 text-h2 tabular-nums">{pack.credits}</p>
              <p className="text-caption text-muted">{formatMoney(pack.amountMinor)}</p>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionDialog action={requestAiCreditPurchaseAction} fields={{ pack: key, method: "online" }} title={`Buy ${pack.credits} credits online`} description="Your request is recorded now. Online payment verification is completed by the platform team until a platform billing gateway is configured." triggerLabel="Online" confirmLabel="Request online checkout" size="sm" disabled={!!pending} success="Purchase request sent." />
                  <ActionDialog action={requestAiCreditPurchaseAction} fields={{ pack: key, method: "offline" }} title={`Request ${pack.credits} credits`} description="Send an offline payment request. The platform team will confirm payment and add the credits." triggerLabel="Offline" confirmLabel="Request offline payment" size="sm" disabled={!!pending} success="Purchase request sent." />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {!canManage ? <p className="mt-3 text-small text-muted">Only the store owner can buy credits.</p> : null}
      </Card>
      {purchases.length ? <PurchaseHistory purchases={purchases} /> : null}
      {ledger.length ? <LedgerHistory ledger={ledger} /> : null}
    </div>
  );
}

function PurchaseHistory({ purchases }: { purchases: AiCreditPurchaseRow[] }) {
  return <Card title="Purchase history"><ul className="divide-y divide-border text-small">{purchases.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="font-medium">{p.credits} credits</span> · {formatMoney(p.amountMinor)} · {p.method}{p.paymentReference ? ` · ${p.paymentReference}` : ""}{p.decisionNote ? <span className="block text-caption text-muted">{p.decisionNote}</span> : null}</span><Badge tone={statusTone[p.status]}>{p.status}</Badge></li>)}</ul></Card>;
}

function LedgerHistory({ ledger }: { ledger: AiCreditLedgerRow[] }) {
  return <Card title="Credit history"><ul className="divide-y divide-border text-small">{ledger.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="font-medium capitalize">{r.kind.replaceAll("_", " ")}</span>{r.note ? <span className="text-muted"> · {r.note}</span> : null}<span className="block text-caption text-muted">{new Date(r.createdAt).toLocaleString("en-IN")}</span></span><span className={`tabular-nums font-medium ${r.delta > 0 ? "text-success" : "text-error"}`}>{signed(r.delta)} <span className="text-muted">· {r.balanceAfter} left</span></span></li>)}</ul></Card>;
}

export function AiCreditAdminPanel({ available, ledger, purchases }: { available: boolean; ledger: (AiCreditLedgerRow & { tenantId: string })[]; purchases: AiCreditPurchaseRow[] }) {
  if (!available) return <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">AI credit tables are unavailable. Apply migration 20261019003400_ai_credits.sql first.</p>;
  const pending = purchases.filter((p) => p.status === "pending");
  return <div className="space-y-6">
    <Card title="Manual credit adjustment" description="Use a positive number to grant credits and a negative number to remove them. Every adjustment is retained in the ledger.">
      <ActionForm action={grantAiCreditsPlatformAction} submitLabel="Save credit adjustment" success="Credit balance adjusted." className="grid gap-3 md:grid-cols-3">
        {(e) => <><TextField label="Store ID" name="tenantId" required errors={e.tenantId} /><TextField label="Credits (+/-)" name="credits" type="number" required errors={e.credits} /><TextAreaField label="Reason" name="note" rows={2} required errors={e.note} /></>}
      </ActionForm>
    </Card>
    <Card title={`Purchase requests${pending.length ? ` (${pending.length} pending)` : ""}`}>
      {purchases.length ? <ul className="divide-y divide-border text-small">{purchases.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{p.credits} credits · {formatMoney(p.amountMinor)} <Badge tone={statusTone[p.status]}>{p.status}</Badge></p><p className="mt-1 font-mono text-caption text-muted">Store: {p.tenantId}</p><p className="text-caption text-muted">{p.method} · {new Date(p.createdAt).toLocaleString("en-IN")}{p.decisionNote ? ` · ${p.decisionNote}` : ""}</p></div>{p.status === "pending" ? <div className="flex gap-2"><ActionDialog action={decideAiCreditPurchasePlatformAction} fields={{ requestId: p.id, decision: "approve" }} title="Approve credit purchase?" description={`This adds ${p.credits} credits to the store ledger.`} triggerLabel="Approve" confirmLabel="Approve & add credits" success="Credits added.">{(e) => <><TextField label="Payment reference" name="paymentReference" optional maxLength={160} errors={e.paymentReference} /><TextAreaField label="Note" name="note" rows={2} optional maxLength={500} errors={e.note} /></>}</ActionDialog><ActionDialog action={decideAiCreditPurchasePlatformAction} fields={{ requestId: p.id, decision: "decline" }} title="Decline credit purchase?" triggerLabel="Decline" confirmLabel="Decline" variant="danger" success="Declined.">{(e) => <TextAreaField label="Reason" name="note" rows={2} optional maxLength={500} errors={e.note} />}</ActionDialog></div> : null}</li>)}</ul> : <p className="text-small text-muted">No credit purchase requests yet.</p>}
    </Card>
    {ledger.length ? <Card title="Recent ledger activity"><ul className="divide-y divide-border text-small">{ledger.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span><span className="font-mono text-caption text-muted">{r.tenantId}</span><span className="block capitalize">{r.kind.replaceAll("_", " ")}{r.note ? ` · ${r.note}` : ""}</span></span><span className={`tabular-nums ${r.delta > 0 ? "text-success" : "text-error"}`}>{signed(r.delta)} · {r.balanceAfter} left</span></li>)}</ul></Card> : null}
  </div>;
}
