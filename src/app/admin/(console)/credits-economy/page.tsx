import type { Metadata } from "next";
import { Badge, Card, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { requirePlatform } from "@/lib/platform/access";
import { savingsMinor } from "@/features/platform-finance/calc";
import { TabNav } from "@/features/ai-health/tab-nav";
import { ECONOMY_TABS, economyTab, storeSearchSchema } from "@/features/ai-credits/economy-schemas";
import { getCreditInsights, getCreditPricing, listActionCosts, listPacks, listPromos, listPromoUses, searchStoresForGrant } from "@/features/ai-credits/economy-server";
import { ActionCostForm, CreatePackDialog, CreatePromoForm, DeletePackDialog, EditPackDialog, GrantCreditsDialog, PricingForm, PromoStatus, PromoToggle } from "@/features/ai-credits/economy-components";
import { PlatformPaymentsPanel } from "@/features/ai-credits/gateway-components";
import { getPlatformGatewayStatus } from "@/features/ai-credits/platform-gateways";
import { getAppCredentialStatus } from "@/features/platform-apps/server";
import { platformOrigin } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Credits economy" };

const nf = new Intl.NumberFormat("en-IN");

function Pending() {
  return (
    <Card title="Pending migration">
      <p className="text-small text-muted">
        This section needs migration <code className="font-mono text-caption">20261025003900_ai_economy.sql</code>, which is not applied to this database yet. Until then credits use the built-in defaults (1 credit per action, 100 welcome credits, fixed packs).
      </p>
    </Card>
  );
}

export default async function CreditsEconomyPage({ searchParams }: PageProps<"/admin/credits-economy">) {
  const ctx = await requirePlatform("platform.settings.manage");
  const sp = await searchParams;
  const tab = economyTab(sp.tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Credits economy" description="AI credit pricing, per-action costs, packs and promo codes sellers see, payment gateways for wallet recharge, usage insights and manual grants." />
      <TabNav base="/admin/credits-economy" tabs={ECONOMY_TABS} active={tab} label="Credits economy sections" />
      {tab === "pricing" ? <PricingTab ctx={ctx} /> : null}
      {tab === "actions" ? <ActionsTab ctx={ctx} /> : null}
      {tab === "packs" ? <PacksTab ctx={ctx} /> : null}
      {tab === "promos" ? <PromosTab ctx={ctx} /> : null}
      {tab === "payments" ? <PaymentsTab ctx={ctx} /> : null}
      {tab === "insights" ? <InsightsTab ctx={ctx} /> : null}
      {tab === "grant" ? <GrantTab ctx={ctx} q={storeSearchSchema.parse({ q: sp.q }).q} /> : null}
    </div>
  );
}

type Ctx = Awaited<ReturnType<typeof requirePlatform>>;

async function PricingTab({ ctx }: { ctx: Ctx }) {
  const pricing = await getCreditPricing(ctx);
  if (!pricing.available) return <Pending />;
  return (
    <Card title="Pricing" description="Changes apply to new purchases and new stores right away. Existing balances are not changed.">
      <PricingForm pricing={pricing.data} />
    </Card>
  );
}

async function ActionsTab({ ctx }: { ctx: Ctx }) {
  const costs = await listActionCosts(ctx);
  if (!costs.available) return <Pending />;
  return (
    <Card title="AI actions" description="Credits charged per AI action (refunded in full when the AI call fails) and the minutes of work each one saves, used for savings in Insights.">
      {costs.data.length ? (
        <ul className="divide-y divide-border">
          {costs.data.map((r) => (
            <li key={r.kind} className="py-3">
              <ActionCostForm row={r} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No actions" description="The migration seeds one row per AI action; none were found." />
      )}
    </Card>
  );
}

async function PaymentsTab({ ctx }: { ctx: Ctx }) {
  const origin = platformOrigin();
  const [status, rz, cf] = await Promise.all([getPlatformGatewayStatus(), getAppCredentialStatus(ctx, "razorpay"), getAppCredentialStatus(ctx, "cashfree")]);
  return (
    <PlatformPaymentsPanel
      status={status}
      razorpaySavedInDb={rz.savedInDb}
      cashfreeSavedInDb={cf.savedInDb}
      webhookUrls={{ razorpay: `${origin}/api/webhooks/platform/razorpay`, cashfree: `${origin}/api/webhooks/platform/cashfree` }}
    />
  );
}

async function PacksTab({ ctx }: { ctx: Ctx }) {
  const packs = await listPacks(ctx);
  if (!packs.available) return <Pending />;
  return (
    <Card title="Credit packs" description="Active packs are offered to sellers on the AI credits panel, in sort order." actions={<CreatePackDialog />}>
      {packs.data.length ? (
        <Table caption="Credit packs">
          <thead>
            <tr>
              <th className={th}>Pack</th>
              <th className={th}>Credits</th>
              <th className={th}>Price</th>
              <th className={th}>Per credit</th>
              <th className={th}>Status</th>
              <th className={th}>Sort</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packs.data.map((p) => (
              <tr key={p.code}>
                <td className={td}>
                  <p className="font-medium">{p.label}</p>
                  <p className="font-mono text-caption text-muted">{p.code}</p>
                </td>
                <td className={`${td} tabular-nums`}>{nf.format(p.credits)}</td>
                <td className={`${td} tabular-nums`}>{formatMoney(p.priceMinor)}</td>
                <td className={`${td} tabular-nums text-muted`}>₹{(p.priceMinor / 100 / p.credits).toFixed(3)}</td>
                <td className={td}>
                  <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "active" : "hidden"}</Badge>
                </td>
                <td className={`${td} tabular-nums`}>{p.sortOrder}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2">
                    <EditPackDialog pack={p} />
                    <DeletePackDialog pack={p} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No packs" description="Sellers can still buy a custom amount. Create a pack to offer fixed bundles." />
      )}
    </Card>
  );
}

async function PromosTab({ ctx }: { ctx: Ctx }) {
  const [promos, uses] = await Promise.all([listPromos(ctx), listPromoUses(ctx)]);
  if (!promos.available) return <Pending />;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return (
    <div className="space-y-4">
      <Card title="New promo code" description="Adds bonus credits as a percentage of the pack or custom amount. A use is counted when the seller sends the purchase request.">
        <CreatePromoForm />
      </Card>
      <Card title="Promo codes">
        {promos.data.length ? (
          <ul className="divide-y divide-border text-small">
            {promos.data.map((p) => {
              const list = uses[p.code] ?? [];
              return (
                <li key={p.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono font-medium">
                        {p.code} <PromoStatus promo={p} today={today} />
                      </p>
                      <p className="text-caption text-muted">
                        +{p.bonusPct}% credits · {p.startsAt ?? "any start"} → {p.endsAt ?? "no end"} · {p.uses}
                        {p.maxUses != null ? ` / ${p.maxUses}` : ""} uses
                      </p>
                    </div>
                    <PromoToggle promo={p} />
                  </div>
                  {list.length ? (
                    <details>
                      <summary className="cursor-pointer text-caption text-accent">Show {list.length} use{list.length === 1 ? "" : "s"}</summary>
                      <ul className="mt-2 space-y-1 text-caption text-muted">
                        {list.map((u, i) => (
                          <li key={i}>
                            {u.tenantName} · {u.credits} credits (incl. +{u.bonus}) · {u.status} · {new Date(u.createdAt).toLocaleDateString("en-IN")}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No promo codes yet" />
        )}
      </Card>
    </div>
  );
}

async function InsightsTab({ ctx }: { ctx: Ctx }) {
  const [insights, costs, pricing] = await Promise.all([getCreditInsights(ctx), listActionCosts(ctx), getCreditPricing(ctx)]);
  if (!insights.available || !insights.data) return <Pending />;
  const i = insights.data;
  const labels = new Map(costs.data.map((c) => [c.kind, c.label]));
  const totalSavings = i.byKind.reduce((n, k) => n + savingsMinor(k.minutesSaved, pricing.data), 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="mint" label="Credits in wallets" value={nf.format(i.balance)} hint={`${nf.format(i.accounts)} stores`} />
        <StatCard tone="lavender" label="Granted" value={nf.format(i.granted)} hint="Welcome and manual grants" />
        <StatCard tone="peach" label="Purchased" value={nf.format(i.purchased)} hint={`${formatMoney(i.revenueMinor)} revenue (approved)`} />
        <StatCard tone="sky" label="Used" value={nf.format(i.used)} hint={`Seller time saved ≈ ${formatMoney(totalSavings)}`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard tone="amber" label="Low balance stores" value={nf.format(i.lowBalance)} hint={`At or below ${pricing.data.lowBalance} credits`} />
        <StatCard tone="rose" label="Critical balance stores" value={nf.format(i.criticalBalance)} hint={`At or below ${pricing.data.criticalBalance} credits`} />
      </div>
      <Card title="Usage by AI action" description={`Savings = minutes saved × freelancer rate (${formatMoney(pricing.data.freelancerHourlyMinor)}/hour).`}>
        {i.byKind.length ? (
          <Table caption="Usage by AI action">
            <thead>
              <tr>
                <th className={th}>Action</th>
                <th className={th}>Uses</th>
                <th className={th}>Credits</th>
                <th className={th}>Hours saved</th>
                <th className={th}>Savings</th>
              </tr>
            </thead>
            <tbody>
              {i.byKind.map((k) => (
                <tr key={k.kind}>
                  <td className={td}>
                    {labels.get(k.kind) ?? k.kind}
                    <span className="ml-2 font-mono text-caption text-muted">{k.kind}</span>
                  </td>
                  <td className={`${td} tabular-nums`}>{nf.format(k.uses)}</td>
                  <td className={`${td} tabular-nums`}>{nf.format(k.credits)}</td>
                  <td className={`${td} tabular-nums`}>{(k.minutesSaved / 60).toFixed(1)}</td>
                  <td className={`${td} tabular-nums`}>{formatMoney(savingsMinor(k.minutesSaved, pricing.data))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No AI usage yet" />
        )}
      </Card>
      <Card title="Top stores by credits used">
        {i.topStores.length ? (
          <ol className="divide-y divide-border text-small">
            {i.topStores.map((s, n) => (
              <li key={s.tenantId} className="flex justify-between gap-2 py-2">
                <span>
                  {n + 1}. {s.name}
                </span>
                <span className="tabular-nums">{nf.format(s.credits)} credits</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No usage yet" />
        )}
      </Card>
    </div>
  );
}

async function GrantTab({ ctx, q }: { ctx: Ctx; q: string | undefined }) {
  const stores = await searchStoresForGrant(ctx, q);
  return (
    <Card title="Grant credits" description="Find a store by name or slug, then grant or remove credits. Every change is ledgered and audited.">
      <form method="get" action="/admin/credits-economy" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="grant" />
        <label className="flex-1 text-small">
          <span className="sr-only">Search stores</span>
          <input name="q" defaultValue={q ?? ""} placeholder="Store name or slug" maxLength={80} className="w-full rounded-md border border-border bg-surface px-3 py-2" />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>
      {stores.length ? (
        <ul className="divide-y divide-border text-small">
          {stores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{s.name}</span> <span className="text-caption text-muted">{s.slug}</span>
                <span className="block text-caption text-muted">{s.balance == null ? "No credit account yet" : `${nf.format(s.balance)} credits`}</span>
              </span>
              <GrantCreditsDialog tenantId={s.id} storeName={s.name} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No stores found" description={q ? "Try another name or slug." : undefined} />
      )}
    </Card>
  );
}
