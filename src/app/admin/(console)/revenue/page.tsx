import type { Metadata } from "next";
import { BadgeIndianRupee, Bot, Coins, Palette, Percent, Repeat } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { formatMoney } from "@/lib/money";
import { bpsToPercentLabel, marginBps } from "@/features/platform-finance/calc";
import { getRevenueReport } from "@/features/platform-finance/server/revenue";
import { PendingMigrationNotice } from "@/features/platform-finance/components/pending-migration";

export const metadata: Metadata = { title: "Revenue P&L" };

const money = (minor: number) => <span className={minor < 0 ? "text-error" : undefined}>{formatMoney(minor)}</span>;

export default async function RevenuePage() {
  await requirePlatform("platform.finance.read");
  const r = await getRevenueReport();
  const header = <PageHeader title="Revenue P&L" description="Subscriptions, GMV commission, AI credit packs and theme sales, net of AI cost. All amounts in ₹." />;
  if (!r.ready) {
    return (
      <div className="space-y-6">
        {header}
        <PendingMigrationNotice what="Revenue P&L" />
      </div>
    );
  }
  const p = r.profit;
  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="MRR" tone="mint" icon={<Repeat />} value={formatMoney(r.mrrMinor)} hint={`${r.paying} paying · ${r.trial} on trial`} />
        <StatCard label="Commission · 30 days" tone="lavender" icon={<Percent />} value={formatMoney(r.commission30.commissionMinor)} hint={`on ${formatMoney(r.commission30.gmvMinor)} GMV`} />
        <StatCard label="Credit packs · 30 days" tone="peach" icon={<Coins />} value={formatMoney(r.creditPacks30Minor)} hint={`${r.creditPacks30Count} approved · ${formatMoney(r.creditPacksLifetimeMinor)} lifetime`} />
        <StatCard label="Theme sales · 30 days" tone="sky" icon={<Palette />} value={formatMoney(0)} hint="Marketplace themes are free" />
        <StatCard label="AI cost · lifetime" tone="rose" icon={<Bot />} value={formatMoney(r.aiCostLifetimeMinor)} hint={`${formatMoney(r.aiCost30Minor)} in the last 30 days`} />
      </div>

      <Card title="Net profit" description="Gross revenue minus AI cost.">
        <div className="grid gap-6 sm:grid-cols-2">
          <ProfitBlock period="Monthly (last 30 days)" gross={p.grossMonthlyMinor} net={p.netMonthlyMinor} ai={r.aiCost30Minor} />
          <ProfitBlock period="Lifetime" gross={p.grossLifetimeMinor} net={p.netLifetimeMinor} ai={r.aiCostLifetimeMinor} />
        </div>
        <p className="mt-4 text-caption text-muted">
          There is no subscription payment ledger yet, so the lifetime subscription part is the current MRR ({formatMoney(r.mrrMinor)}). Lifetime commission is all-time GMV ({formatMoney(r.commissionLifetime.gmvMinor)}) at each store&apos;s current plan rate.
        </p>
      </Card>

      <Card title="Subscription breakdown" description={`${r.totalStores} store${r.totalStores === 1 ? "" : "s"} (cancelled stores excluded). Trial stores don't count towards MRR.`}>
        <Table caption="Subscriptions by plan">
          <thead>
            <tr>
              <th className={th}>Plan</th>
              <th className={`${th} text-right`}>Stores</th>
              <th className={`${th} text-right`}>Paying</th>
              <th className={`${th} text-right`}>Trial</th>
              <th className={`${th} text-right`}>Price / month</th>
              <th className={`${th} text-right`}>Commission</th>
              <th className={`${th} text-right`}>Plan MRR</th>
            </tr>
          </thead>
          <tbody>
            {r.plans.map((row) => (
              <tr key={row.planId ?? "none"}>
                <td className={td}>{row.planName}</td>
                <td className={`${td} text-right tabular-nums`}>{row.stores}</td>
                <td className={`${td} text-right tabular-nums`}>{row.paying}</td>
                <td className={`${td} text-right tabular-nums`}>{row.trial}</td>
                <td className={`${td} text-right tabular-nums`}>{row.planId ? formatMoney(row.priceMonthlyMinor) : "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{row.planId ? bpsToPercentLabel(row.commissionBps) : "—"}</td>
                <td className={`${td} text-right tabular-nums font-medium`}>{formatMoney(row.mrrMinor)}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} font-medium`}>Total</td>
              <td className={`${td} text-right tabular-nums font-medium`}>{r.totalStores}</td>
              <td className={`${td} text-right tabular-nums font-medium`}>{r.paying}</td>
              <td className={`${td} text-right tabular-nums font-medium`}>{r.trial}</td>
              <td className={td} />
              <td className={td} />
              <td className={`${td} text-right tabular-nums font-medium`}>{formatMoney(r.mrrMinor)}</td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <Card title="AI cost by model" description="Lifetime tokens × the model's blended price per 1M tokens (set on AI Health).">
        {r.aiModels.length ? (
          <Table caption="AI cost by model">
            <thead>
              <tr>
                <th className={th}>Provider · model</th>
                <th className={`${th} text-right`}>Calls</th>
                <th className={`${th} text-right`}>Tokens</th>
                <th className={`${th} text-right`}>₹ / 1M tokens</th>
                <th className={`${th} text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {r.aiModels.map((m) => (
                <tr key={`${m.provider}/${m.model}`}>
                  <td className={td}>
                    <span className="font-medium">{m.provider}</span> <span className="font-mono text-caption text-muted">{m.model || "(no model)"}</span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{m.calls.toLocaleString("en-IN")}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.tokens.toLocaleString("en-IN")}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.pricePerMillionMinor === null ? <Badge tone="warning">unpriced</Badge> : formatMoney(m.pricePerMillionMinor)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(m.costMinor)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No AI usage yet" description="AI generations appear here with their token cost." />
        )}
        {r.unpricedModels.length ? (
          <p className="mt-3 text-caption text-muted">
            {r.unpricedModels.length} model{r.unpricedModels.length === 1 ? " has" : "s have"} no price, so {r.unpricedModels.length === 1 ? "its" : "their"} tokens are not in the AI cost. Set prices on AI Health.
          </p>
        ) : null}
      </Card>

      <Card title="Theme P&L" description="Marketplace themes are free presets: there are no theme purchases, so price and revenue are ₹0. Adoption counts stores whose published storefront uses the theme.">
        {r.themes.length ? (
          <Table caption="Theme adoption">
            <thead>
              <tr>
                <th className={th}>Theme</th>
                <th className={`${th} text-right`}>Stores</th>
                <th className={`${th} text-right`}>Price</th>
                <th className={`${th} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {r.themes.map((t) => (
                <tr key={t.themeKey}>
                  <td className={td}>
                    <span className="font-medium">{t.label}</span> {t.label !== t.themeKey ? <span className="font-mono text-caption text-muted">{t.themeKey}</span> : null}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{t.stores}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(0)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No published themes" description="Stores appear here once they publish a storefront theme." />
        )}
      </Card>
    </div>
  );
}

function ProfitBlock({ period, gross, net, ai }: { period: string; gross: number; net: number; ai: number }) {
  const margin = marginBps(net, gross);
  return (
    <div>
      <p className="flex items-center gap-2 text-overline text-muted">
        <BadgeIndianRupee className="size-4" aria-hidden /> {period}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-small">
        <dt className="text-muted">Gross</dt>
        <dd className="text-right tabular-nums">{money(gross)}</dd>
        <dt className="text-muted">AI cost</dt>
        <dd className="text-right tabular-nums">{money(ai ? -ai : 0)}</dd>
        <dt className="font-medium">Net</dt>
        <dd className="text-right text-h3 tabular-nums font-semibold">{money(net)}</dd>
        <dt className="text-muted">Margin</dt>
        <dd className="text-right tabular-nums">{gross > 0 ? bpsToPercentLabel(margin) : "—"}</dd>
      </dl>
    </div>
  );
}
