import type { Metadata } from "next";
import Link from "next/link";
import { can, requireTenant } from "@/lib/tenant/membership";
import { formatMoney } from "@/lib/money";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import type { ReactNode } from "react";
import { IndianRupee, Package, Receipt, ShoppingBag, Users } from "lucide-react";
import { Card, PageHeader, StatCard, type StatTone } from "@/components/ui/layout";
import { getDashboardHome, type HomeKpis, type SetupStep } from "@/features/analytics/home";
import { RevenueChart } from "@/features/analytics/components/revenue-chart";
import { StatusBadge } from "@/features/orders-admin/components/status-badge";
import { orderNumberLabel } from "@/features/orders-admin/format";
import { getLaunchStatusForMember } from "@/features/stores/launch";
import { PreviewStoreButton, PublishStoreButton } from "@/features/stores/components/launch-controls";
import { RecentActivityCard } from "@/features/notifications/inbox/components/recent-activity-card";
import { CopyButton } from "@/features/domains/components/domain-controls";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Home" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function greeting(now = new Date()): "pages.home.morning" | "pages.home.afternoon" | "pages.home.evening" {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  return h < 12 ? "pages.home.morning" : h < 17 ? "pages.home.afternoon" : "pages.home.evening";
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">No prior data</span>;
  const tone = value > 0 ? "bg-success/10 text-success" : value < 0 ? "bg-error/10 text-error" : "bg-surface-secondary text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 tabular-nums ${tone}`}>
      {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
      {Math.abs(value)}%<span className="sr-only"> vs previous 30 days</span>
    </span>
  );
}

const KPI_ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

function KpiStrip({ kpis, customers, products, allProducts }: { kpis: HomeKpis | null; customers: number | null; products: number; allProducts: number }) {
  const items: { label: string; value: string; tone: StatTone; icon: ReactNode; hint?: ReactNode; trend?: ReactNode }[] = [];
  if (kpis) {
    items.push({ label: "Revenue", value: formatMoney(kpis.revenueMinor), tone: "mint", icon: <IndianRupee {...KPI_ICON} />, trend: <Change value={kpis.revenueChange} />, hint: "Last 30 days" });
    items.push({ label: "Orders", value: String(kpis.orders), tone: "lavender", icon: <ShoppingBag {...KPI_ICON} />, trend: <Change value={kpis.ordersChange} />, hint: "Last 30 days" });
    items.push({ label: "Average order", value: kpis.orders ? formatMoney(kpis.aovMinor) : "—", tone: "peach", icon: <Receipt {...KPI_ICON} />, hint: "Per order, last 30 days" });
  }
  if (customers !== null) items.push({ label: "Customers", value: String(customers), tone: "sky", icon: <Users {...KPI_ICON} />, hint: "All time" });
  // Total catalogue first: "Active" alone hid drafts and looked like products were missing.
  items.push({
    label: "Products",
    value: String(allProducts),
    tone: "rose",
    icon: <Package {...KPI_ICON} />,
    hint: (
      <Link href="/dashboard/products" className="hover:text-foreground hover:underline">
        {products} live{allProducts > products ? ` · ${allProducts - products} draft` : ""} · View all
      </Link>
    ),
  });
  return (
    <section aria-label="Key numbers" data-tour="kpis" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((i) => (
        <StatCard key={i.label} tone={i.tone} icon={i.icon} label={i.label} value={i.value} hint={i.hint} trend={i.trend} />
      ))}
    </section>
  );
}

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card tour="setup" title="Get your store ready" description={`${done} of ${steps.length} done`}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-3">
              <span aria-hidden className={`grid size-5 place-items-center rounded-full border text-[11px] ${s.done ? "border-success bg-success text-background" : "border-border"}`}>
                {s.done ? "✓" : ""}
              </span>
              <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
              <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
            </span>
            {s.done ? null : (
              <Link href={s.href} className="shrink-0 font-medium text-accent hover:underline">
                Start
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function DashboardHome() {
  const ctx = await requireTenant();
  const [home, launch, { t }] = await Promise.all([getDashboardHome(ctx), getLaunchStatusForMember(ctx.tenantId), getI18n()]);
  const storeUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  const firstName = ctx.user.displayName?.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(greeting())}${firstName ? `, ${firstName}` : ""}`}
        description={t("pages.home.last30", { store: ctx.tenantName })}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <span className="max-w-[12rem] truncate text-sm text-muted sm:max-w-[18rem]" title={storeUrl}>
              {storeUrl.replace(/^https?:\/\//, "")}
            </span>
            <CopyButton value={storeUrl} label="storefront URL" />
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background">
              View store ↗
            </a>
          </div>
        }
      />

      {launch === "draft" ? (
        <Card title="Your store is a private draft" description="Visitors see a ‘coming soon’ page. Preview it, then publish when you're ready to take orders.">
          <div className="flex flex-wrap items-start gap-3">
            {can(ctx, "theme.edit") ? <PreviewStoreButton /> : null}
            {can(ctx, "settings.write") ? <PublishStoreButton /> : <p className="text-sm text-muted">Ask the store owner or an admin to publish the store.</p>}
          </div>
        </Card>
      ) : null}

      <SetupChecklist steps={home.setup} />

      <KpiStrip kpis={home.sales?.kpis ?? null} customers={home.counts.customers} products={home.counts.activeProducts} allProducts={home.counts.allProducts} />

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
    </div>
  );
}
