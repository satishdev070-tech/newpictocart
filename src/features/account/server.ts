import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/supabase/errors";
import { logger } from "@/lib/observability/logger";
import { assertPlatformPermission, type PlatformContext } from "@/lib/platform/access";
import type { TenantContext } from "@/lib/tenant/membership";
import { buildExport } from "./schemas";

/**
 * My Profile (seller + admin). Everything about the person is read and written with their own
 * session (RLS: own profiles row, own memberships). Two exceptions use the secret-key client
 * (ADR-006): the store's partner link (partner_referrals is platform-only under RLS) for the
 * membership-resolved tenant, and platform-wide order/product head counts after a
 * platform.tenants.read check.
 */

export type OwnProfile = { displayName: string | null; phone: string | null; createdAt: string | null };

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("display_name, phone, created_at").eq("id", userId).maybeSingle();
  return { displayName: data?.display_name ?? null, phone: data?.phone ?? null, createdAt: data?.created_at ?? null };
}

export type StoreOverview = { name: string; slug: string; category: string | null; createdAt: string | null };

export async function getStoreOverview(ctx: TenantContext): Promise<StoreOverview> {
  const supabase = await createSupabaseServerClient();
  const [{ data: tenant }, { data: store }] = await Promise.all([
    supabase.from("tenants").select("name, slug, created_at").eq("id", ctx.tenantId).maybeSingle(),
    supabase.from("stores").select("store_categories(name)").eq("tenant_id", ctx.tenantId).maybeSingle(),
  ]);
  const cat = (store as { store_categories?: { name: string } | { name: string }[] | null } | null)?.store_categories;
  return {
    name: tenant?.name ?? ctx.tenantName,
    slug: tenant?.slug ?? ctx.tenantSlug,
    category: (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? null,
    createdAt: tenant?.created_at ?? null,
  };
}

export type PartnerLink = { name: string; email: string; code: string; source: string; since: string } | null;

/** Partner this store was referred by. Tenant comes from the membership context, never input. */
export async function getStorePartnerLink(ctx: TenantContext): Promise<PartnerLink> {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("partner_referrals")
      .select("source, created_at, partners(name, email, partner_code)")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!data) return null;
    const p = data.partners as { name: string; email: string; partner_code: string } | { name: string; email: string; partner_code: string }[] | null;
    const partner = Array.isArray(p) ? p[0] : p;
    if (!partner) return null;
    return { name: partner.name, email: partner.email, code: partner.partner_code, source: data.source, since: data.created_at };
  } catch (err) {
    logger.warn("account.partner_link_failed", { error: err });
    return null;
  }
}

export type PlatformTotals = { orders: number | null; products: number | null };

/** Platform-wide head counts (no rows read) for the admin profile. */
export async function getPlatformTotals(ctx: PlatformContext): Promise<PlatformTotals> {
  assertPlatformPermission(ctx, "platform.tenants.read");
  const admin = createSupabaseAdminClient();
  const [orders, products] = await Promise.all([
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
  ]);
  return { orders: orders.error ? null : (orders.count ?? 0), products: products.error ? null : (products.count ?? 0) };
}

export type SessionInfo = { userId: string; lastSignInAt: string | null; providers: string[]; emailVerified: boolean; createdAt: string | null };

/** From Supabase Auth with the user's own session (verified server-side by getUser). */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  const providers = Array.isArray(u.app_metadata?.providers) ? (u.app_metadata.providers as string[]) : u.app_metadata?.provider ? [String(u.app_metadata.provider)] : [];
  return { userId: u.id, lastSignInAt: u.last_sign_in_at ?? null, providers, emailVerified: Boolean(u.email_confirmed_at), createdAt: u.created_at ?? null };
}

const EXPORT_LIMIT = 5000;

/** "Export your data": own profile + memberships, and stores/products/orders of stores the user owns. RLS session only. */
export async function buildAccountExport(user: { id: string; email: string | null }) {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: memberships, error: mErr }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, phone, avatar_url, status, created_at, updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("tenant_memberships").select("tenant_id, role, status, created_at").eq("user_id", user.id),
  ]);
  if (mErr) throw mapDbError(mErr);
  const owned = (memberships ?? []).filter((m) => m.role === "owner" && m.status === "active").map((m) => m.tenant_id);
  const [stores, products, orders] = owned.length
    ? await Promise.all([
        supabase.from("tenants").select("id, name, slug, status, created_at").in("id", owned),
        supabase.from("products").select("id, tenant_id, title, slug, status, min_price, max_price, tags, created_at, updated_at").in("tenant_id", owned).limit(EXPORT_LIMIT),
        supabase
          .from("orders")
          .select("id, tenant_id, order_number, status, payment_status, fulfillment_status, grand_total, currency, placed_at, created_at")
          .in("tenant_id", owned)
          .order("created_at", { ascending: false })
          .limit(EXPORT_LIMIT),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  return buildExport({
    user,
    profile: (profile as Record<string, unknown> | null) ?? null,
    memberships: memberships ?? [],
    stores: (stores.data ?? []) as Record<string, unknown>[],
    products: (products.data ?? []) as Record<string, unknown>[],
    orders: (orders.data ?? []) as Record<string, unknown>[],
    generatedAt: new Date().toISOString(),
  });
}
