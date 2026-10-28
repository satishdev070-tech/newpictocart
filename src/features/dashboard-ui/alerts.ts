import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { can, type TenantContext } from "@/lib/tenant/membership";

export type DashboardAlert = { key: string; label: string; count: number; href: string };

/**
 * Head count of confirmed orders still unfulfilled/packed. Request-cached so the layout bell and
 * dashboard home share one query (ADR-010: live, not Redis).
 */
export const countOrdersToFulfil = cache(async (tenantId: string): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .in("fulfillment_status", ["unfulfilled", "packed"]);
  if (error) throw mapDbError(error);
  return count ?? 0;
});

/**
 * Real, actionable counts for the topbar bell (only what the member may see). Head-only counts;
 * never throws (the shell must render).
 */
export const getDashboardAlerts = cache(async (ctx: TenantContext): Promise<DashboardAlert[]> => {
  if (!can(ctx, "orders.read")) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const [toFulfil, returns] = await Promise.all([
      countOrdersToFulfil(ctx.tenantId),
      supabase.from("returns").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("status", "requested"),
    ]);
    return [
      { key: "fulfil", label: "orders waiting to be fulfilled", count: toFulfil, href: "/dashboard/orders?fulfillment=unfulfilled" },
      { key: "returns", label: "return requests to review", count: returns.count ?? 0, href: "/dashboard/returns?status=requested" },
    ].filter((a) => a.count > 0);
  } catch {
    return [];
  }
});
