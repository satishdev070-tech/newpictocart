/**
 * Compact, model-friendly facts about ONE store (pure, unit tested). Built from data the server
 * already read with the seller's own session; the model never sees ids it could echo back as
 * links, and money stays in integer paise.
 */
import type { DashboardHome } from "@/features/analytics/home";

export type SnapshotProduct = { title: string; status: string; minPrice: number | null; stockTotal: number | null; categoryName: string | null };

export type StoreSnapshotInput = {
  storeName: string;
  storeStatus: string;
  storeUrl: string;
  home: Pick<DashboardHome, "sales" | "counts" | "recentOrders" | "lowStock" | "setup">;
  products: SnapshotProduct[];
  creditBalance: number | null;
};

const line = (label: string, value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? null : `${label}: ${value}`);

/** Metrics object for the business coach (no invented numbers: missing panels stay null). */
export function coachMetrics(home: StoreSnapshotInput["home"]) {
  return {
    revenueMinor30d: home.sales?.kpis.revenueMinor ?? null,
    orders30d: home.sales?.kpis.orders ?? null,
    aovMinor30d: home.sales?.kpis.aovMinor ?? null,
    revenueChangePct: home.sales?.kpis.revenueChange ?? null,
    ordersChangePct: home.sales?.kpis.ordersChange ?? null,
    activeProducts: home.counts.activeProducts,
    allProducts: home.counts.allProducts,
    customers: home.counts.customers,
    toFulfil: home.counts.toFulfil,
    lowStock: home.lowStock?.total ?? null,
  };
}

export function topProductLines(home: StoreSnapshotInput["home"], max = 5): string[] {
  return (home.sales?.topProducts ?? []).slice(0, max).map((p) => `${p.title} — ${p.units} sold, ${p.revenueMinor} paise`);
}

export function lowStockLines(home: StoreSnapshotInput["home"], max = 5): string[] {
  return (home.lowStock?.items ?? []).slice(0, max).map((v) => `${v.title}${v.variant ? ` (${v.variant})` : ""}: ${v.outOfStock ? "out of stock" : `${v.available} left`}`);
}

/** Plain-text store facts for the agent prompt, capped so a large catalogue can't blow the context. */
export function buildStoreSnapshot(s: StoreSnapshotInput): string {
  const { home } = s;
  const k = home.sales?.kpis;
  const out: (string | null)[] = [
    line("Store", s.storeName),
    line("Status", s.storeStatus),
    line("Storefront", s.storeUrl),
    line("AI credits left", s.creditBalance),
    k
      ? `Last 30 days: revenue ${k.revenueMinor} paise (${k.revenueChange === null ? "no prior data" : `${k.revenueChange}% vs previous 30 days`}), ${k.orders} orders (${k.ordersChange === null ? "no prior data" : `${k.ordersChange}%`}), average order ${k.aovMinor} paise`
      : "Sales: not visible to this team member",
    `Products: ${home.counts.allProducts} total, ${home.counts.activeProducts} live`,
    line("Customers", home.counts.customers),
    line("Orders waiting to be fulfilled", home.counts.toFulfil),
  ];
  const top = topProductLines(home);
  if (top.length) out.push(`Top sellers (30 days):\n- ${top.join("\n- ")}`);
  const low = lowStockLines(home, 8);
  if (low.length) out.push(`Low or out of stock (${home.lowStock?.total ?? low.length}):\n- ${low.join("\n- ")}`);
  if (home.recentOrders?.length) {
    out.push(
      `Recent orders:\n- ${home.recentOrders
        .slice(0, 8)
        .map((o) => `#${o.number} ${o.placedAt.slice(0, 10)} ${o.totalMinor} paise, payment ${o.paymentStatus}, fulfilment ${o.fulfillmentStatus}`)
        .join("\n- ")}`,
    );
  }
  if (s.products.length) {
    out.push(
      `Catalogue (latest ${s.products.length}):\n- ${s.products
        .map((p) => `${p.title} [${p.status}]${p.categoryName ? ` in ${p.categoryName}` : ""}, price ${p.minPrice ?? "not set"} paise, stock ${p.stockTotal ?? "not tracked"}`)
        .join("\n- ")}`,
    );
  }
  const pending = home.setup.filter((x) => !x.done).map((x) => x.label);
  out.push(`Setup steps still to do: ${pending.length ? pending.join("; ") : "none"}`);
  return out.filter(Boolean).join("\n").slice(0, 6000);
}
