"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Clock, KeyRound, Plus, Sparkles, Ticket, TrendingDown, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, StatCard } from "@/components/ui/layout";
import { TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/actions/result";
import { hoursLabel, type WalletSummary } from "@/features/seller-ai/wallet";
import { SELLER_AI_KIND_LABELS } from "@/features/seller-ai/schemas";
import { AI_FEATURES } from "@/features/ai-health/registry";
import type { AiCreditCatalog, AiCreditLedgerRow, AiCreditPurchaseRow } from "./schemas";
import { AiCreditBuyPanel } from "./components";
import * as aiCreditActions from "./actions";

type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

const OTC_ACTION_KEYS = ["redeemAiCreditCodeAction", "redeemAiCreditOtcAction", "redeemAiOtcCodeAction", "redeemOtcAction"] as const;

/** Pick up OTC redeem when a parallel agent lands it on ai-credits/actions. */
function resolveOtcRedeemAction(): FormAction | null {
  const bag = aiCreditActions as Record<string, unknown>;
  for (const key of OTC_ACTION_KEYS) {
    const fn = bag[key];
    if (typeof fn === "function") return fn as FormAction;
  }
  return null;
}

const NUMBER = new Intl.NumberFormat("en-IN");
const statusTone = { pending: "warning", approved: "success", declined: "error", cancelled: "neutral" } as const;

function ledgerNoteLabel(note: string | null): string | null {
  if (!note) return null;
  const seller = SELLER_AI_KIND_LABELS[note as keyof typeof SELLER_AI_KIND_LABELS];
  if (seller) return seller;
  const feature = AI_FEATURES.find((f) => f.creditKind === note || f.key === note);
  return feature?.label ?? note;
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function SlideOver({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button, a, input, select, textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Close recharge panel" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3">
              {title}
            </h2>
            {description ? <p className="mt-1 text-caption text-muted">{description}</p> : null}
          </div>
          <Button type="button" variant="secondary" size="sm" aria-label="Close" onClick={onClose}>
            <X aria-hidden className="size-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const OTC_UNAVAILABLE: FormAction = async () => ({
  ok: false,
  error: { code: "CONFLICT", message: "One-time codes are not available yet.", fieldErrors: { _form: ["One-time codes are not available yet."] } },
});

function OtcModal({ open, onClose, canManage }: { open: boolean; onClose: () => void; canManage: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const redeem = resolveOtcRedeemAction();
  const [state, formAction] = useActionState(redeem ?? OTC_UNAVAILABLE, null);
  const { show } = useToast();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      show({ tone: "success", message: "Code redeemed. Credits added." });
      onClose();
    } else {
      show({ tone: "error", message: state.error.fieldErrors?.code?.[0] ?? state.error.fieldErrors?._form?.[0] ?? state.error.message });
    }
  }, [state, show, onClose]);
  const errors = fieldErrors(state);
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(92vw,420px)] rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40" onClose={onClose}>
      <form action={redeem ? formAction : undefined} className="space-y-4 p-5" onSubmit={redeem ? undefined : (e) => e.preventDefault()}>
        <div>
          <h2 id={titleId} className="text-h3">
            Use one-time code
          </h2>
          <p className="mt-1 text-small text-muted">Enter a partner or promo one-time code to add AI credits to this store.</p>
        </div>
        {!canManage ? <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-small text-warning">Only the store owner can redeem codes.</p> : null}
        {!redeem ? <p className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-small text-muted">Code redemption will activate when the platform finishes rolling out one-time codes.</p> : null}
        {state && !state.ok ? <FormMessage state={state} /> : null}
        <TextField label="One-time code" name="code" required autoComplete="off" autoCapitalize="characters" placeholder="OTC-XXXXXXXXXXXX" disabled={!canManage || !redeem} errors={errors.code} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton disabled={!canManage || !redeem}>Redeem</SubmitButton>
        </div>
      </form>
    </dialog>
  );
}

export function AiWalletPageView({
  summary,
  moneySavedMinor,
  available,
  balance,
  ledger,
  purchases,
  catalog,
  canManage,
  gatewayConfigured = false,
  storeName = "AI credits",
}: {
  summary: WalletSummary;
  moneySavedMinor: number;
  available: boolean;
  balance: number;
  ledger: AiCreditLedgerRow[];
  purchases: AiCreditPurchaseRow[];
  catalog: AiCreditCatalog;
  canManage: boolean;
  gatewayConfigured?: boolean;
  storeName?: string;
}) {
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [otcOpen, setOtcOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-h1">AI Credits Wallet</h1>
          <p className="mt-1 text-body text-muted">Balance, savings and activity for every AI feature in your store.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setOtcOpen(true)}>
            <Ticket aria-hidden className="size-4" /> Use one-time code
          </Button>
          {canManage ? (
            <Button type="button" size="sm" onClick={() => setRechargeOpen(true)}>
              <Plus aria-hidden className="size-4" /> Recharge
            </Button>
          ) : null}
        </div>
      </div>

      {!available ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">AI credit accounting will activate when the pending database migration is applied. AI features keep working normally until then.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard tone="peach" label="Balance" value={NUMBER.format(summary.balance)} hint="credits available" icon={<Wallet aria-hidden />} />
            <StatCard tone="mint" label="Money saved" value={formatMoney(moneySavedMinor)} hint="Estimated freelancer cost avoided (30 days)" icon={<TrendingDown aria-hidden />} />
            <StatCard tone="sky" label="Time saved" value={`${hoursLabel(summary.minutesSaved)} hrs`} hint={`${NUMBER.format(summary.uses)} AI actions in 30 days`} icon={<Clock aria-hidden />} />
          </div>

          <div className="rounded-xl border border-accent/20 bg-gradient-to-r from-accent-soft to-surface px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium">{NUMBER.format(balance)} credits ready</p>
                <p className="text-caption text-muted">Shared across Neural Pulse, Creative Studio, product AI and the store assistant.</p>
              </div>
              {canManage ? (
                <Button type="button" size="sm" onClick={() => setRechargeOpen(true)}>
                  <Plus aria-hidden className="size-4" /> Recharge
                </Button>
              ) : null}
            </div>
          </div>

          {ledger.length ? (
            <Card title="Activity">
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
          ) : (
            <p className="text-small text-muted">No credit activity yet.</p>
          )}

          {purchases.length ? (
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
          ) : null}
        </>
      )}

      <SlideOver
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        title="Recharge AI credits"
        description={gatewayConfigured ? "Choose a pack or amount and pay online. Credits appear after payment confirms." : "Choose a pack, custom amount, or promo. Credits are added after payment is verified."}
      >
        <AiCreditBuyPanel catalog={catalog} canManage={canManage} purchases={purchases} compact gatewayConfigured={gatewayConfigured} storeName={storeName} />
      </SlideOver>

      <OtcModal open={otcOpen} onClose={() => setOtcOpen(false)} canManage={canManage} />
    </div>
  );
}

/** Compact Neural Pulse CTA pointing sellers at the dedicated wallet. */
export function AiWalletLinkBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-gradient-to-r from-accent-soft to-surface px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-small font-medium">AI Credits Wallet</p>
          <p className="text-caption text-muted">Check balance, recharge packs and view activity.</p>
        </div>
      </div>
      <Link href="/dashboard/wallet" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-small font-semibold text-white hover:bg-accent/90">
        Open wallet
      </Link>
    </div>
  );
}
