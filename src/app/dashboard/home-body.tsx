import Link from "next/link";
import { can, requireTenant } from "@/lib/tenant/membership";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/layout";
import { getDashboardHome } from "@/features/analytics/home";
import { RevenueChart } from "@/features/analytics/components/revenue-chart";
import { StatusBadge } from "@/features/orders-admin/components/status-badge";
import { orderNumberLabel } from "@/features/orders-admin/format";
import { getLaunchStatusForMember } from "@/features/stores/launch";
import { PreviewStoreButton, PublishStoreButton } from "@/features/stores/components/launch-controls";
import { RecentActivityCard } from "@/features/notifications/inbox/components/recent-activity-card";
import { BusinessCoachCard } from "@/features/seller-ai/components/business-coach-card";
import { AiWalletCard } from "@/features/seller-ai/components/ai-wallet-card";
import { getAiWalletSummary } from "@/features/seller-ai/server";
import type { Messages } from "@/lib/i18n/messages/en";
import { HomeKpiStrip, HomeSetupChecklist } from "./home-panels";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Heavy home panels streamed under Suspense so the greeting/header paints first.
 * getDashboardHome fail-softs individual RPCs — this child should not pink-screen the route.
 */
export async function DashboardHomeBody({ coachText, walletText }: { coachText: Messages["ai"]["coach"]; walletText: Messages["ai"]["wallet"] }) {
  const ctx = await requireTenant();
  const [home, launch, wallet] = await Promise.all([
    getDashboardHome(ctx),
    getLaunchStatusForMember(ctx.tenantId),
    can(ctx, "marketing.read") ? getAiWalletSummary(ctx.tenantId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <>
      {launch === "draft" ? (
        <Card title="Your store is a private draft" description="Visitors see a ‘coming soon’ page. Preview it, then publish when you're ready to take orders.">
          <div className="flex flex-wrap items-start gap-3">
            {can(ctx, "theme.edit") ? <PreviewStoreButton /> : null}
            {can(ctx, "settings.write") ? <PublishStoreButton /> : <p className="text-sm text-muted">Ask the store owner or an admin to publish the store.</p>}
          </div>
        </Card>
      ) : null}

      {wallet ? <AiWalletCard summary={wallet} text={walletText} canRecharge={can(ctx, "billing.manage")} /> : null}

      <HomeSetupChecklist steps={home.setup} />

      <HomeKpiStrip kpis={home.sales?.kpis ?? null} customers={home.counts.customers} products={home.counts.activeProducts} allProducts={home.counts.allProducts} />

      {can(ctx, "analytics.read") ? <BusinessCoachCard text={coachText} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {home.sales ? (
            <Card title="Sales" description="Revenue per day, excluding cancelled and unpaid orders" actions={<Link href="/dashboard/analytics" className="text-sm font-medium text-accent hover:underline">Analytics</Link>}>
              {home.sales.kpis.orders ? <RevenueChart days={home.sales.days} /> : <p className="py-10 text-center text-sm text-muted">No sales in the last 30 days yet. Share your store link to get your first order.</p>}
            </Card>
          ) : null}

          {home.recentOrders ? (
            <Card title="Recent orders" actions={<Link href="/dashboard/orders" className="text-sm font-medium text-accent hover:underline">All orders</Link>}>
              {home.recentOrders.length ? (
                <ul className="-my-2 divide-y divide-border">
                  {home.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/dashboard/orders/${o.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-background">
                        <span className="w-16 shrink-0 font-medium tabular-nums">{orderNumberLabel(o.number)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{o.customer}</span>
                          <span className="block text-xs text-muted">{dateFmt.format(new Date(o.placedAt))}</span>
                        </span>
                        <span className="hidden gap-1.5 sm:flex">
                          <StatusBadge status={o.paymentStatus} />
                          <StatusBadge status={o.fulfillmentStatus} />
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">{formatMoney(o.totalMinor)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted">Orders will appear here as soon as shoppers check out.</p>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <RecentActivityCard audience={{ userId: ctx.user.id, scope: "tenant", tenantId: ctx.tenantId }} href="/dashboard/notifications" />

          {home.counts.toFulfil !== null || home.lowStock ? (
            <Card title="Needs attention">
              <ul className="space-y-3 text-sm">
                {home.counts.toFulfil !== null ? (
                  <li className="flex items-center justify-between">
                    <span>Orders to fulfil</span>
                    <Link href="/dashboard/orders?fulfillment=unfulfilled" className={`font-semibold tabular-nums ${home.counts.toFulfil ? "text-accent hover:underline" : "text-muted"}`}>
                      {home.counts.toFulfil}
                    </Link>
                  </li>
                ) : null}
                {home.lowStock ? (
                  <li>
                    <div className="flex items-center justify-between">
                      <span>Low or out of stock</span>
                      <Link href="/dashboard/inventory?stock=low" className={`font-semibold tabular-nums ${home.lowStock.total ? "text-accent hover:underline" : "text-muted"}`}>
                        {home.lowStock.total}
                      </Link>
                    </div>
                    {home.lowStock.items.length ? (
                      <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                        {home.lowStock.items.map((v) => (
                          <li key={v.variantId} className="flex items-center justify-between gap-2 text-xs">
                            <Link href={`/dashboard/products/${v.productId}`} className="min-w-0 truncate hover:underline">
                              {v.title}
                              {v.variant && v.variant !== "Default" ? <span className="text-muted"> · {v.variant}</span> : null}
                            </Link>
                            <span className={`shrink-0 tabular-nums ${v.outOfStock ? "text-error" : "text-warning"}`}>{v.outOfStock ? "Sold out" : `${v.available} left`}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}

          {home.sales ? (
            <Card title="Top products" description="By revenue, last 30 days">
              {home.sales.topProducts.length ? (
                <ol className="space-y-2.5 text-sm">
                  {home.sales.topProducts.map((p, i) => (
                    <li key={p.productId ?? p.title} className="flex items-center gap-3">
                      <span className="w-4 text-xs text-muted tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="text-xs text-muted tabular-nums">{p.units} sold</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Your best sellers will show here.</p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
