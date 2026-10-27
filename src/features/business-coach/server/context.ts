import "server-only";
import { getDashboardHome } from "@/features/analytics/home";
import { formatMoney } from "@/lib/money";
import type { TenantContext } from "@/lib/tenant/membership";

export type CoachStoreContext = {
  storeName: string;
  metrics: Record<string, unknown>;
  products: { title: string; units: number; revenue: string }[];
  setupPending: string[];
};

/**
 * Compact store snapshot for the edge coach prompt. Reuses the dashboard home loader so
 * permission gates and RLS stay identical to what the seller already sees.
 */
export async function loadCoachStoreContext(ctx: TenantContext): Promise<CoachStoreContext> {
  const home = await getDashboardHome(ctx);
  const kpis = home.sales?.kpis;
  const metrics: Record<string, unknown> = {
    activeProducts: home.counts.activeProducts,
    allProducts: home.counts.allProducts,
    customers: home.counts.customers,
    ordersToFulfil: home.counts.toFulfil,
    lowStock: home.lowStock?.total ?? null,
  };
  if (kpis) {
    metrics.last30 = {
      revenue: formatMoney(kpis.revenueMinor),
      orders: kpis.orders,
      aov: formatMoney(kpis.aovMinor),
      revenueChangePct: kpis.revenueChange,
      ordersChangePct: kpis.ordersChange,
    };
  }
  return {
    storeName: ctx.tenantName,
    metrics,
    products: (home.sales?.topProducts ?? []).slice(0, 5).map((p) => ({
      title: p.title.slice(0, 80),
      units: p.units,
      revenue: formatMoney(p.revenueMinor),
    })),
    setupPending: home.setup.filter((s) => !s.done).map((s) => s.label),
  };
}
