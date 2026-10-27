import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/http/safe-redirect";
import { logger } from "@/lib/observability/logger";
import { customerAccess, type CustomerAccess } from "./blocked";
import { nameFromAuthMetadata, splitPersonName } from "./names";

/**
 * Shopper identity on a storefront (ADR-016): Supabase auth cookies are per host, and one
 * auth user maps to a separate `customers` row per tenant. Linking/creating that row is a
 * server-only step (there is no customer INSERT policy) done with the secret key, always for
 * the tenant resolved from the verified host and the user id from a verified JWT.
 */
export type StoreCustomer = {
  id: string;
  tenantId: string;
  authUserId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  acceptsMarketing: boolean;
};

const COLUMNS = "id, tenant_id, auth_user_id, email, phone, first_name, last_name, accepts_marketing, status";

type Row = {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  accepts_marketing: boolean;
  status: string;
};

function toCustomer(row: Row, authUserId: string): StoreCustomer | null {
  if (row.status !== "active") return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authUserId,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    acceptsMarketing: row.accepts_marketing,
  };
}

/** The signed-in user's raw customer row for this tenant (any status), or null. */
const getSessionCustomerRow = cache(async (tenantId: string): Promise<{ row: Row; userId: string } | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("customers")
    .select(COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) {
    logger.error("customer.lookup_failed", { tenantId, error: error.message });
    return null;
  }
  return data ? { row: data, userId: user.id } : null;
});

/** The signed-in shopper's customer row for this tenant, or null (signed out / not linked / blocked). */
export const getStoreCustomer = cache(async (tenantId: string): Promise<StoreCustomer | null> => {
  const found = await getSessionCustomerRow(tenantId);
  return found ? toCustomer(found.row, found.userId) : null;
});

/**
 * Whether the signed-in user's customer row for this tenant is active or blocked by the store.
 * Read fresh (not the request cache): it runs right after sign-in may have linked the row.
 */
export async function getStoreCustomerAccess(tenantId: string): Promise<CustomerAccess> {
  const user = await getSessionUser();
  if (!user) return "none";
  const { data } = await createSupabaseAdminClient().from("customers").select("status").eq("tenant_id", tenantId).eq("auth_user_id", user.id).maybeSingle();
  return customerAccess(data);
}

/**
 * Links the signed-in auth user to this tenant's customer row, creating it if needed.
 * An existing guest row is matched by email ONLY when the auth email is verified, so nobody
 * can claim another shopper's order history by registering their address unverified.
 */
export async function ensureStoreCustomer(tenantId: string): Promise<StoreCustomer | null> {
  const existing = await getStoreCustomer(tenantId);
  if (existing) return existing;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const email = user.email?.trim().toLowerCase() ?? null;
  const verified = Boolean(email && user.email_confirmed_at);
  if (!verified || !email) return null;

  const admin = createSupabaseAdminClient();
  const { data: byEmail } = await admin.from("customers").select(COLUMNS).eq("tenant_id", tenantId).eq("email", email).maybeSingle();
  if (byEmail) {
    if (byEmail.auth_user_id && byEmail.auth_user_id !== user.id) {
      logger.warn("customer.link_conflict", { tenantId, customerId: byEmail.id });
      return null;
    }
    if (!byEmail.auth_user_id) {
      // A guest row from an earlier checkout may have no name: take it from the identity (e.g. Google).
      const metaName = byEmail.first_name ? null : nameFromAuthMetadata(user.user_metadata);
      const named = metaName ? splitPersonName(metaName) : null;
      const { data: linked, error } = await admin
        .from("customers")
        .update({ auth_user_id: user.id, ...(named ? { first_name: named.first, last_name: named.last } : {}) })
        .eq("tenant_id", tenantId)
        .eq("id", byEmail.id)
        .is("auth_user_id", null)
        .select(COLUMNS)
        .maybeSingle();
      if (error || !linked) {
        logger.warn("customer.link_failed", { tenantId, error: error?.message });
        return null;
      }
      return toCustomer(linked, user.id);
    }
    return toCustomer(byEmail, user.id);
  }

  const metaName = nameFromAuthMetadata(user.user_metadata);
  const named = metaName ? splitPersonName(metaName) : null;
  const { data: created, error } = await admin
    .from("customers")
    .insert({ tenant_id: tenantId, auth_user_id: user.id, email, first_name: named?.first ?? null, last_name: named?.last ?? null })
    .select(COLUMNS)
    .single();
  if (error) {
    // Lost a race with a concurrent request: read the winner.
    const { data: again } = await admin.from("customers").select(COLUMNS).eq("tenant_id", tenantId).eq("auth_user_id", user.id).maybeSingle();
    return again ? toCustomer(again, user.id) : null;
  }
  return toCustomer(created, user.id);
}

/** For account pages: redirect to the store login when there is no linked customer. */
export async function requireStoreCustomer(tenantId: string, next: string): Promise<StoreCustomer> {
  const customer = (await getStoreCustomer(tenantId)) ?? (await ensureStoreCustomer(tenantId));
  if (!customer) {
    // A blocked shopper gets a clear message on the login page instead of a silent bounce.
    if ((await getStoreCustomerAccess(tenantId)) === "blocked") redirect("/account/login?error=blocked");
    const user = await getSessionUser();
    const target = safeRedirectPath(next, "/account");
    redirect(user ? `/account/login?verify=1&next=${encodeURIComponent(target)}` : `/account/login?next=${encodeURIComponent(target)}`);
  }
  return customer;
}

/**
 * Signed-in shopper without a saved name (e.g. linked before Google names were read): take it
 * from the verified identity's metadata and store it on the customer row, so checkout prefills
 * it now and every time after. Best-effort; returns the customer unchanged when there is none.
 */
export async function withIdentityName(customer: StoreCustomer): Promise<StoreCustomer> {
  if (customer.firstName) return customer;
  const { data: auth } = await (await createSupabaseServerClient()).auth.getUser();
  if (!auth.user || auth.user.id !== customer.authUserId) return customer;
  const metaName = nameFromAuthMetadata(auth.user.user_metadata);
  if (!metaName) return customer;
  const named = splitPersonName(metaName);
  const { error } = await createSupabaseAdminClient()
    .from("customers")
    .update({ first_name: named.first, last_name: named.last })
    .eq("tenant_id", customer.tenantId)
    .eq("id", customer.id)
    .is("first_name", null);
  if (error) logger.warn("customer.name_backfill_failed", { tenantId: customer.tenantId, error: error.message });
  return { ...customer, firstName: named.first, lastName: named.last };
}
