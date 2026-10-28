"use client";

import { useState } from "react";
import { formatMoney, toMinor } from "@/lib/money";
import { Badge, Card } from "@/components/ui/layout";
import { ActionDialog, ActionForm } from "@/features/settings/ui/action-controls";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { CopyValue, ResultDialog } from "@/features/partners/components/result-dialog";
import { FALLBACK_PACKS, aiCreditOtcDisplay, type AiCreditCatalog, type AiCreditLedgerRow, type AiCreditOtcRow, type AiCreditPurchaseRow } from "./schemas";
import { redeemAiCreditCodeAction } from "./actions";
import { createAiCreditCodeAction, decideAiCreditPurchasePlatformAction, grantAiCreditsPlatformAction, revokeAiCreditCodeAction } from "./platform-actions";
import { SELLER_AI_KIND_LABELS } from "@/features/seller-ai/schemas";
import { AI_FEATURES } from "@/features/ai-health/registry";
import { BuyCreditsDialog } from "./buy-credits-dialog";

function ledgerNoteLabel(note: string | null): string | null {
  if (!note) return null;
  const seller = SELLER_AI_KIND_LABELS[note as keyof typeof SELLER_AI_KIND_LABELS];
  if (seller) return seller;
  const feature = AI_FEATURES.find((f) => f.creditKind === note || f.key === note);
  return feature?.label ?? note;
}

const statusTone = { pending: "warning", approved: "success", declined: "error", cancelled: "neutral" } as const;

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function PromoField({ errors }: { errors?: string[] }) {
  return <TextField label="Promo code" name="promo" optional maxLength={30} autoCapitalize="characters" placeholder="DIWALI25" hint="Bonus credits are added to this purchase." errors={errors} />;
}

function MethodField({ gatewayConfigured = false }: { gatewayConfigured?: boolean }) {
  return (
    <SelectField
      label="Payment method"
      name="method"
      defaultValue="online"
      options={
        gatewayConfigured
          ? [
              { value: "online", label: "Pay online now" },
              { value: "offline", label: "Offline (bank transfer / UPI, confirmed manually)" },
            ]
          : [
              { value: "online", label: "Online (verified by the platform team)" },
              { value: "offline", label: "Offline (bank transfer / UPI, confirmed manually)" },
            ]
      }
    />
  );
}

function CustomAmount({ custom, errors }: { custom: NonNullable<AiCreditCatalog["custom"]>; errors?: string[] }) {
  const [value, setValue] = useState("");
  const minor = /^\d{1,8}(\.\d{1,2})?$/.test(value.trim()) ? toMinor(value.trim()) : 0;
  const credits = minor > 0 ? Math.floor((minor * custom.creditsPerRupee) / 100) : 0;
  return (
    <div>
      <TextField label="Amount (₹)" name="amount" inputMode="decimal" required value={value} onChange={(e) => setValue(e.target.value)} hint={`Between ${formatMoney(custom.minMinor)} and ${formatMoney(custom.maxMinor)} · ${custom.creditsPerRupee} credits per ₹1`} errors={errors} />
      <p aria-live="polite" className="mt-1 text-small">{credits > 0 ? <>You get <span className="font-semibold tabular-nums">{credits.toLocaleString("en-IN")}</span> credits{minor < custom.minMinor || minor > custom.maxMinor ? <span className="text-error"> (outside the allowed range)</span> : null}</> : null}</p>
    </div>
  );
}

/** Packs + custom amount + promo — reused by Neural Pulse (legacy) and the wallet recharge slide-over. */
export function AiCreditBuyPanel({
  catalog,
  canManage,
  purchases,
  compact = false,
  gatewayConfigured = false,
  storeName = "AI credits",
}: {
  catalog?: AiCreditCatalog;
  canManage: boolean;
  purchases: AiCreditPurchaseRow[];
  compact?: boolean;
  gatewayConfigured?: boolean;
  storeName?: string;
}) {
  const cat = catalog ?? { configurable: false, packs: FALLBACK_PACKS, costs: [], custom: null };
  const custom = cat.custom;
  const pending = purchases.find((p) => p.status === "pending");
  return (
    <div className="space-y-3">
      {pending ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-small text-warning">
          One purchase is already awaiting confirmation.
        </p>
      ) : null}
      <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-3"}>
        {cat.packs.map((pack) => (
          <div key={pack.code} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-semibold">{pack.label}</p>
            <p className="mt-1 text-h2 tabular-nums">{pack.credits.toLocaleString("en-IN")}</p>
            <p className="text-caption text-muted">{formatMoney(pack.priceMinor)}</p>
            {canManage ? (
              <div className="mt-3">
                <BuyCreditsDialog
                  fields={{ pack: pack.code }}
                  title={`Buy ${pack.credits.toLocaleString("en-IN")} credits`}
                  description={
                    gatewayConfigured
                      ? `${pack.label} pack for ${formatMoney(pack.priceMinor)}. Pay online to add credits after payment confirms.`
                      : `${pack.label} pack for ${formatMoney(pack.priceMinor)}. Your request is recorded now; the platform team verifies the payment and adds the credits.`
                  }
                  triggerLabel="Buy"
                  confirmLabel={gatewayConfigured ? "Continue to payment" : "Send purchase request"}
                  disabled={!!pending}
                  storeName={storeName}
                  amountMinor={pack.priceMinor}
                  packLabel={pack.label}
                >
                  {(e) => (
                    <div className="space-y-3">
                      <MethodField gatewayConfigured={gatewayConfigured} />
                      {cat.configurable ? <PromoField errors={e.promo} /> : null}
                    </div>
                  )}
                </BuyCreditsDialog>
              </div>
            ) : null}
          </div>
        ))}
        {custom ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4">
            <p className="font-semibold">Custom amount</p>
            <p className="mt-1 text-small text-muted">
              {formatMoney(custom.minMinor)} – {formatMoney(custom.maxMinor)}
            </p>
            <p className="text-caption text-muted">{custom.creditsPerRupee} credits per ₹1</p>
            {canManage ? (
              <div className="mt-3">
                <BuyCreditsDialog
                  fields={{ pack: "custom" }}
                  title="Buy a custom amount of credits"
                  description={
                    gatewayConfigured
                      ? "Pay online to add credits after payment confirms."
                      : "Your request is recorded now; the platform team verifies the payment and adds the credits."
                  }
                  triggerLabel="Choose amount"
                  confirmLabel={gatewayConfigured ? "Continue to payment" : "Send purchase request"}
                  disabled={!!pending}
                  storeName={storeName}
                  amountMinor={custom.minMinor}
                  packLabel="Custom"
                >
                  {(e) => (
                    <div className="space-y-3">
                      <CustomAmount custom={custom} errors={e.amount} />
                      <MethodField gatewayConfigured={gatewayConfigured} />
                      <PromoField errors={e.promo} />
                    </div>
                  )}
                </BuyCreditsDialog>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!canManage ? <p className="text-small text-muted">Only the store owner can buy credits.</p> : null}
    </div>
  );
}

export function AiCreditPurchaseHistory({ purchases }: { purchases: AiCreditPurchaseRow[] }) {
  return (
    <Card title="Purchase history">
      <ul className="divide-y divide-border text-small">
        {purchases.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium">{p.credits} credits</span> · {formatMoney(p.amountMinor)} · {p.pack === "custom" ? "custom amount" : p.pack} · {p.method}
              {p.paymentReference ? ` · ${p.paymentReference}` : ""}
              {p.decisionNote ? <span className="block text-caption text-muted">{p.decisionNote}</span> : null}
            </span>
            <Badge tone={statusTone[p.status]}>{p.status}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AiCreditLedgerHistory({ ledger, title = "Credit history" }: { ledger: AiCreditLedgerRow[]; title?: string }) {
  return (
    <Card title={title}>
      <ul className="divide-y divide-border text-small">
        {ledger.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium capitalize">{r.kind.replaceAll("_", " ")}</span>
              {r.note ? <span className="text-muted"> · {ledgerNoteLabel(r.note)}</span> : null}
              <span className="block text-caption text-muted">{new Date(r.createdAt).toLocaleString("en-IN")}</span>
            </span>
            <span className={`tabular-nums font-medium ${r.delta > 0 ? "text-success" : "text-error"}`}>
              {signed(r.delta)} <span className="text-muted">· {r.balanceAfter} left</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AiCreditSellerPanel({
  available,
  balance,
  ledger,
  purchases,
  canManage,
  catalog,
  gatewayConfigured = false,
  storeName = "AI credits",
}: {
  available: boolean;
  balance: number;
  ledger: AiCreditLedgerRow[];
  purchases: AiCreditPurchaseRow[];
  canManage: boolean;
  catalog?: AiCreditCatalog;
  gatewayConfigured?: boolean;
  storeName?: string;
}) {
  if (!available) return <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">AI credit accounting will activate when the pending database migration is applied. AI features keep working normally until then.</p>;
  const cat = catalog ?? { configurable: false, packs: FALLBACK_PACKS, costs: [], custom: null };
  const uniform = cat.costs.length > 0 && cat.costs.every((c) => c.credits === cat.costs[0]?.credits);
  const costLine = !cat.configurable || !cat.costs.length ? "Each AI generation uses one credit." : uniform ? `Each AI generation uses ${cat.costs[0]?.credits} credit${cat.costs[0]?.credits === 1 ? "" : "s"}.` : "Each AI action uses the credits listed below.";
  const buyHint = purchases.some((p) => p.status === "pending")
    ? "One purchase is already awaiting confirmation."
    : gatewayConfigured
      ? "Choose a pack or an amount. Pay online to add credits, or request offline verification."
      : "Choose a pack or an amount. Credits are added only after the payment is verified.";
  return (
    <div className="space-y-4">
      <Card title="AI credits" description={`${costLine} A failed AI call is refunded automatically.`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{balance}</p>
            <p className="text-small text-muted">credits available</p>
          </div>
          <p className="max-w-lg text-caption text-muted">Credits are shared by your store&apos;s AI writing and site-builder tools. They are not consumed when an AI provider fails.</p>
        </div>
        {cat.configurable && cat.costs.length && !uniform ? (
          <ul className="mt-4 grid gap-x-6 gap-y-1 text-small sm:grid-cols-2">
            {cat.costs.map((c) => (
              <li key={c.kind} className="flex justify-between gap-2 border-b border-border py-1">
                <span>{c.label}</span>
                <span className="tabular-nums text-muted">
                  {c.credits} credit{c.credits === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {canManage ? <RedeemAiCreditCodeCard /> : null}
      <Card title="Buy credits" description={buyHint}>
        <AiCreditBuyPanel catalog={cat} canManage={canManage} purchases={purchases} gatewayConfigured={gatewayConfigured} storeName={storeName} />
      </Card>
      {purchases.length ? <AiCreditPurchaseHistory purchases={purchases} /> : null}
      {ledger.length ? <AiCreditLedgerHistory ledger={ledger} /> : null}
    </div>
  );
}

const otcStatusTone = { unused: "success", redeemed: "neutral", revoked: "error" } as const;

/** Seller form: redeem a platform OTC into this store's balance. Wallet pages may import this. */
export function RedeemAiCreditCodeCard() {
  return (
    <Card title="Redeem a code" description="Enter a one-time code from the Pictocart team. Credits are added to this store immediately.">
      <ActionForm action={redeemAiCreditCodeAction} submitLabel="Redeem code" success="Credits added." className="grid max-w-md gap-3 sm:grid-cols-[1fr_auto] sm:items-end" resetOnSuccess>
        {(e) => <TextField label="Code" name="code" required autoComplete="off" autoCapitalize="characters" placeholder="OTC-XXXXXXXXXXXX" errors={e.code} />}
      </ActionForm>
    </Card>
  );
}

function CreateAiCreditCodeButton() {
  return (
    <ResultDialog
      action={createAiCreditCodeAction}
      title="Generate a credit code"
      description="A seller redeems it for AI credits. Only a hash is stored, so the code is shown once."
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
          <TextField label="Credits" name="credits" type="number" required min={1} max={1_000_000} placeholder="100" errors={e.credits} />
          <TextField label="Note" name="note" optional maxLength={200} errors={e.note} />
        </>
      )}
    </ResultDialog>
  );
}

function RevokeAiCreditCodeButton({ codeId, hint }: { codeId: string; hint: string }) {
  return <ActionDialog action={revokeAiCreditCodeAction} fields={{ codeId }} title={`Revoke code …${hint}?`} description="It can no longer be redeemed." triggerLabel="Revoke" confirmLabel="Revoke" variant="danger" success="Code revoked." />;
}

export function AiCreditCodesPanel({ available, codes }: { available: boolean; codes: AiCreditOtcRow[] }) {
  if (!available) {
    return (
      <Card title="One-time codes" description="Platform-generated AI credit codes sellers redeem once.">
        <p className="text-small text-muted">
          Apply migration <code className="font-mono text-caption">20261028004500_ai_credit_one_time_codes.sql</code> to enable generate and redeem.
        </p>
      </Card>
    );
  }
  return (
    <Card title="One-time codes" description="Each code adds its credits to one store, once. Only a hash and the last four characters are stored." actions={<CreateAiCreditCodeButton />}>
      {codes.length === 0 ? (
        <p className="text-small text-muted">No codes generated yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-left text-body">
            <thead>
              <tr>
                <th className="px-4 py-2 text-caption font-medium text-muted sm:px-5">Code</th>
                <th className="px-4 py-2 text-right text-caption font-medium text-muted sm:px-5">Credits</th>
                <th className="px-4 py-2 text-caption font-medium text-muted sm:px-5">Status</th>
                <th className="px-4 py-2 text-caption font-medium text-muted sm:px-5">Used by</th>
                <th className="px-4 py-2 text-caption font-medium text-muted sm:px-5">Created</th>
                <th className="px-4 py-2 text-caption font-medium text-muted sm:px-5" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5 sm:px-5">
                    <span className="font-mono text-small">{aiCreditOtcDisplay(c.hint)}</span>
                    {c.note ? <p className="text-caption text-muted">{c.note}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums sm:px-5">{c.credits.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 sm:px-5">
                    <Badge tone={otcStatusTone[c.status as keyof typeof otcStatusTone] ?? "neutral"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 sm:px-5">
                    {c.redeemedTenantName ?? (c.redeemedTenantId ? <span className="font-mono text-caption">{c.redeemedTenantId}</span> : "—")}
                    {c.redeemedAt ? <p className="text-caption text-muted">{new Date(c.redeemedAt).toLocaleString("en-IN")}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 text-caption text-muted sm:px-5">{new Date(c.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 sm:px-5">{c.status === "unused" ? <RevokeAiCreditCodeButton codeId={c.id} hint={c.hint} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function AiCreditAdminPanel({ available, ledger, purchases, codes = [], codesAvailable = false }: { available: boolean; ledger: (AiCreditLedgerRow & { tenantId: string })[]; purchases: AiCreditPurchaseRow[]; codes?: AiCreditOtcRow[]; codesAvailable?: boolean }) {
  if (!available) return <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">AI credit tables are unavailable. Apply migration 20261019003400_ai_credits.sql first.</p>;
  const pending = purchases.filter((p) => p.status === "pending");
  return (
    <div className="space-y-6">
      <AiCreditCodesPanel available={codesAvailable} codes={codes} />
      <Card title="Manual credit adjustment" description="Use a positive number to grant credits and a negative number to remove them. Every adjustment is retained in the ledger.">
        <ActionForm action={grantAiCreditsPlatformAction} submitLabel="Save credit adjustment" success="Credit balance adjusted." className="grid gap-3 md:grid-cols-3">
          {(e) => (
            <>
              <TextField label="Store ID" name="tenantId" required errors={e.tenantId} />
              <TextField label="Credits (+/-)" name="credits" type="number" required errors={e.credits} />
              <TextAreaField label="Reason" name="note" rows={2} required errors={e.note} />
            </>
          )}
        </ActionForm>
      </Card>
      <Card title={`Purchase requests${pending.length ? ` (${pending.length} pending)` : ""}`}>
        {purchases.length ? (
          <ul className="divide-y divide-border text-small">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {p.credits} credits · {formatMoney(p.amountMinor)} <Badge tone={statusTone[p.status]}>{p.status}</Badge>
                  </p>
                  <p className="mt-1 font-mono text-caption text-muted">Store: {p.tenantId}</p>
                  <p className="text-caption text-muted">
                    {p.method} · {new Date(p.createdAt).toLocaleString("en-IN")}
                    {p.decisionNote ? ` · ${p.decisionNote}` : ""}
                  </p>
                </div>
                {p.status === "pending" ? (
                  <div className="flex gap-2">
                    <ActionDialog action={decideAiCreditPurchasePlatformAction} fields={{ requestId: p.id, decision: "approve" }} title="Approve credit purchase?" description={`This adds ${p.credits} credits to the store ledger.`} triggerLabel="Approve" confirmLabel="Approve & add credits" success="Credits added.">
                      {(e) => (
                        <>
                          <TextField label="Payment reference" name="paymentReference" optional maxLength={160} errors={e.paymentReference} />
                          <TextAreaField label="Note" name="note" rows={2} optional maxLength={500} errors={e.note} />
                        </>
                      )}
                    </ActionDialog>
                    <ActionDialog action={decideAiCreditPurchasePlatformAction} fields={{ requestId: p.id, decision: "decline" }} title="Decline credit purchase?" triggerLabel="Decline" confirmLabel="Decline" variant="danger" success="Declined.">
                      {(e) => <TextAreaField label="Reason" name="note" rows={2} optional maxLength={500} errors={e.note} />}
                    </ActionDialog>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted">No credit purchase requests yet.</p>
        )}
      </Card>
      {ledger.length ? (
        <Card title="Recent ledger activity">
          <ul className="divide-y divide-border text-small">
            {ledger.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-mono text-caption text-muted">{r.tenantId}</span>
                  <span className="block capitalize">
                    {r.kind.replaceAll("_", " ")}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                </span>
                <span className={`tabular-nums ${r.delta > 0 ? "text-success" : "text-error"}`}>
                  {signed(r.delta)} · {r.balanceAfter} left
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
