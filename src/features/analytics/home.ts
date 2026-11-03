import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { toMinor } from "@/lib/money";
import { can, type TenantContext } from "@/lib/tenant/membership";
import { countOrdersToFulfil } from "@/features/dashboard-ui/alerts";
import { addDays, istDateKey, istDayStart } from "./dates";
import { percentChange, zeroFillDays } from "./metrics";
import { softCount, softData } from "./soft-query";

export { softCount, softData } from "./soft-query";

export type HomeKpis = { revenueMinor: number; orders: number; aovMinor: number; revenueChange: number | null; ordersChange: number | null };
export type HomeOrder = { id: string; number: number; customer: string; placedAt: string; totalMinor: number; status: string; paymentStatus: string; fulfillmentStatus: string };
export type HomeLowStock = { variantId: string; productId: string; title: string; variant: string; sku: string | null; available: number; outOfStock: boolean };
export type SetupStep = { key: string; label: string; done: boolean; href: string };

export type DashboardHome = {
  sales: { kpis: HomeKpis; days: { day: string; orders: number; revenueMinor: number }[]; topProducts: { productId: string | null; title: string; units: number; revenueMinor: number }[] } | null;
  counts: { activeProducts: number; allProducts: number; customers: number | null; toFulfil: number | null };
  recentOrders: HomeOrder[] | null;
  lowStock: { items: HomeLowStock[]; total: number } | null;
  setup: SetupStep[];
};

const DAYS = 30;

/**
 * Everything the dashboard home shows, read with the seller's own session (RLS applies).
 * Each panel is only loaded when the member's role grants the matching permission; otherwise
 * it is null and the page hides it. No figures are estimated or invented.
 */
export async function getDashboardHome(ctx: TenantContext, now = new Date()): Promise<DashboardHome> {
  const supabase = await createSupabaseServerClient();
  const t = ctx.tenantId;
  const todayKey = istDateKey(now);
  const fromKey = addDays(todayKey, -(DAYS - 1));
  const prevFromKey = addDays(fromKey, -DAYS);
  const range = { p_tenant: t, p_from: istDayStart(fromKey).toISOString(), p_to: istDayStart(addDays(todayKey, 1)).toISOString() };
  const prevRange = { p_tenant: t, p_from: istDayStart(prevFromKey).toISOString(), p_to: istDayStart(fromKey).toISOString() };

  const analytics = can(ctx, "analytics.read");
  const orders = can(ctx, "orders.read");
  const inventory = can(ctx, "inventory.read");
  const customers = can(ctx, "customers.read");

  // toFulfil shares countOrdersToFulfil with the layout bell (React.cache — one head query per request).
  const [daily, prevDaily, top, recent, toFulfilCount, stock, activeProducts, customerCount, media, theme, shipping, cod, payments, allProducts] = await Promise.all([
    analytics ? supabase.rpc("dashboard_sales_daily", range) : null,
    analytics ? supabase.rpc("dashboard_sales_daily", prevRange) : null,
    analytics ? supabase.rpc("dashboard_top_products", { ...range, p_limit: 5 }) : null,
    orders
      ? supabase
          .from("orders")
          .select("id, order_number, email, customer_snapshot, grand_total, status, payment_status, fulfillment_status, placed_at")
          .eq("tenant_id", t)
          .neq("status", "pending")
          .order("placed_at", { ascending: false })
          .limit(6)
      : null,
    orders ? countOrdersToFulfil(t) : Promise.resolve(null),
    inventory ? supabase.rpc("inventory_overview", { p_tenant: t }) : null,
    supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "active"),
    customers ? supabase.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", t) : null,
    supabase.from("product_media").select("id", { count: "exact", head: true }).eq("tenant_id", t),
    supabase.from("theme_versions").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("status", "published"),
    supabase.from("shipping_rates").select("id", { count: "exact", head: true }).eq("tenant_id", t),
    supabase.from("stores").select("cod_settings").eq("tenant_id", t).maybeSingle(),
    can(ctx, "payments.manage") ? supabase.from("tenant_payment_settings").select("enabled").eq("tenant_id", t).maybeSingle() : null,
    supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", t).neq("status", "archived"),
  ]);
  const dailyRows = softData(daily, "dashboard_sales_daily");
  const prevDailyRows = softData(prevDaily, "dashboard_sales_daily_prev");
  const topRows = softData(top, "dashboard_top_products");
  const recentRows = softData(recent, "recent_orders");
  const stockRows = softData(stock, "inventory_overview");
  const activeCount = softCount(activeProducts, "products_active_count");
  const allCount = softCount(allProducts, "products_all_count");
  const mediaCount = softCount(media, "product_media_count");
  const themeCount = softCount(theme, "theme_published_count");
  const shippingCount = softCount(shipping, "shipping_rates_count");
  const customerTotal = customers ? softCount(customerCount, "customers_count") : null;

  let sales: DashboardHome["sales"] = null;
  if (dailyRows && prevDailyRows && topRows) {
    const days = zeroFillDays(dailyRows.map((d) => ({ day: d.day, orders: d.orders, revenueMinor: toMinor(d.revenue) })), fromKey, todayKey);
    const revenueMinor = days.reduce((s, d) => s + d.revenueMinor, 0);
    const orderCount = days.reduce((s, d) => s + d.orders, 0);
    const prevRevenue = prevDailyRows.reduce((s, d) => s + toMinor(d.revenue), 0);
    const prevOrders = prevDailyRows.reduce((s, d) => s + d.orders, 0);
    sales = {
      kpis: {
        revenueMinor,
        orders: orderCount,
        aovMinor: orderCount ? Math.round(revenueMinor / orderCount) : 0,
        revenueChange: percentChange(prevRevenue, revenueMinor),
        ordersChange: percentChange(prevOrders, orderCount),
      },
      days,
      topProducts: topRows.map((p) => ({ productId: p.product_id, title: p.title, units: p.units, revenueMinor: toMinor(p.revenue) })),
    };
  }

  const recentOrders: HomeOrder[] | null = orders
    ? (recentRows ?? []).map((o) => {
        const snap = (o.customer_snapshot ?? {}) as { first_name?: string; last_name?: string };
        const name = [snap.first_name, snap.last_name].filter(Boolean).join(" ");
        return { id: o.id, number: o.order_number, customer: name || o.email || "Guest", placedAt: o.placed_at, totalMinor: toMinor(o.grand_total), status: o.status, paymentStatus: o.payment_status, fulfillmentStatus: o.fulfillment_status };
      })
    : null;

  const flagged = (stockRows ?? []).filter((v) => v.track_inventory && v.product_status === "active" && (v.out_of_stock || v.low_stock)).sort((a, b) => a.available - b.available);
  const lowStock = inventory
    ? {
        total: flagged.length,
        items: flagged.slice(0, 6).map((v) => ({ variantId: v.variant_id, productId: v.product_id, title: v.product_title, variant: v.variant_title, sku: v.sku, available: v.available, outOfStock: v.out_of_stock })),
      }
    : null;

  const codEnabled = Boolean((cod.error ? null : (cod.data?.cod_settings as { enabled?: boolean } | null))?.enabled);
  if (cod.error) logger.warn("analytics.home_query_failed", { op: "stores_cod", code: cod.error.code, message: cod.error.message });
  const paymentsEnabled = Boolean(payments && !payments.error && payments.data?.enabled);
  if (payments?.error) logger.warn("analytics.home_query_failed", { op: "payment_settings", code: payments.error.code, message: payments.error.message });

  const setup: SetupStep[] = [
    { key: "product", label: "Add your first product", done: activeCount > 0, href: "/dashboard/products/new" },
    { key: "images", label: "Upload product photos", done: mediaCount > 0, href: "/dashboard/products" },
    { key: "shipping", label: "Set shipping rates", done: shippingCount > 0, href: "/dashboard/settings/shipping" },
    { key: "payments", label: "Turn on payments (online or cash on delivery)", done: codEnabled || paymentsEnabled, href: "/dashboard/settings/payments" },
    { key: "theme", label: "Customise and publish your theme", done: themeCount > 0, href: "/dashboard/theme" },
  ];

  return {
    sales,
    counts: { activeProducts: activeCount, allProducts: allCount || activeCount, customers: customerTotal, toFulfil: toFulfilCount },
    recentOrders,
    lowStock,
    setup,
  };
}
