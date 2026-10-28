import Link from "next/link";
import { Clock, Plus, Sparkles, TrendingDown } from "lucide-react";
import type { WalletSummary } from "@/features/seller-ai/wallet";
import { hoursLabel } from "@/features/seller-ai/wallet";

export type AiWalletText = { label: string; credits: string; subtitle: string; used: string; timeSaved: string; hours: string; recharge: string; activity: string };

const NUMBER = new Intl.NumberFormat("en-IN");

/** Dashboard "AI credits wallet" summary (server component; figures from the store's own ledger). */
export function AiWalletCard({ summary, text, canRecharge }: { summary: WalletSummary; text: AiWalletText; canRecharge: boolean }) {
  if (!summary.available) return null;
  return (
    <section aria-label={text.label} className="flex flex-wrap items-center gap-4 rounded-xl border border-accent/20 bg-gradient-to-r from-accent-soft to-surface px-4 py-4 shadow-xs sm:px-5">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-white shadow-sm">
        <Sparkles className="size-6" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-overline text-subtle">{text.label}</p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[2rem] font-bold leading-none tabular-nums text-accent">{NUMBER.format(summary.balance)}</span>
          <span className="text-small text-muted">{text.credits}</span>
        </p>
        <p className="mt-0.5 text-caption text-muted">{text.subtitle}</p>
      </div>
      <dl className="flex w-full gap-5 border-border sm:w-auto sm:border-l sm:pl-5">
        <div>
          <dt className="flex items-center gap-1 text-overline text-subtle">
            <TrendingDown aria-hidden className="size-3.5" /> {text.used}
          </dt>
          <dd className="text-h3 tabular-nums">{NUMBER.format(summary.usedCredits)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-overline text-subtle">
            <Clock aria-hidden className="size-3.5" /> {text.timeSaved}
          </dt>
          <dd className="text-h3 tabular-nums text-success">{text.hours.replace("{hours}", hoursLabel(summary.minutesSaved))}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
        {canRecharge ? (
          <Link href="/dashboard/marketing/neural-pulse#credits" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-small font-semibold text-white hover:bg-accent/90">
            <Plus aria-hidden className="size-4" /> {text.recharge}
          </Link>
        ) : null}
        <Link href="/dashboard/marketing/neural-pulse#credits" className="text-caption font-medium text-muted hover:text-foreground hover:underline">
          {text.activity}
        </Link>
      </div>
    </section>
  );
}
