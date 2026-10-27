/**
 * Single source of truth for roles and permissions.
 * - The app uses `can()` for UI gating and server-side authorization.
 * - Migrations seed `role_permissions` from these constants (see tests/unit/permissions-sql.test.ts),
 *   and RLS policies call `app.has_tenant_permission(tenant_id, key)`.
 * - Tenants may also define CUSTOM roles (table tenant_custom_roles) from TENANT_PERMISSIONS.
 * UI checks are convenience only; the server check + RLS are the real boundary.
 */

export const TENANT_PERMISSIONS = [
  "store.read",
  "catalog.read",
  "catalog.write",
  "catalog.delete",
  "catalog.publish",
  "inventory.read",
  "inventory.write",
  "orders.read",
  "orders.write",
  "orders.cancel",
  "orders.refund",
  "customers.read",
  "customers.write",
  "marketing.read",
  "marketing.write",
  "content.write",
  "theme.edit",
  "theme.publish",
  "reviews.moderate",
  "analytics.read",
  "settings.write",
  "payments.manage",
  "domains.manage",
  "members.read",
  "members.manage",
  "roles.manage",
  "billing.manage",
] as const;
export type TenantPermission = (typeof TENANT_PERMISSIONS)[number];

/** Permissions a custom role may never hold (owner-only). */
export const OWNER_ONLY_PERMISSIONS: readonly TenantPermission[] = ["billing.manage"];

/**
 * Standard member roles (QA #3): the Store Owner (shown as "Store Admin (Owner)"), a Manager
 * who runs the store just below the owner, and a Sales Associate for everyone else. Older roles
 * (admin, staff, catalog/order/… managers, analyst, support agent, viewer) were mapped onto these
 * by migration 20261027004150_team_roles.sql. Anything finer is a tenant-defined custom role.
 */
export const TENANT_ROLES = ["owner", "manager", "sales_associate"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
/** Stored in tenant_memberships.role when the member has a tenant-defined custom role. */
export const CUSTOM_ROLE = "custom" as const;
export type MembershipRole = TenantRole | typeof CUSTOM_ROLE;

/** Everything but owner-only billing: settings, payments, domains, theme publishing, team and roles. */
const MANAGER: TenantPermission[] = TENANT_PERMISSIONS.filter((p) => !OWNER_ONLY_PERMISSIONS.includes(p));

/** Day-to-day selling: orders, customers, products (view/edit, no publish/delete) and stock. */
const SALES_ASSOCIATE: TenantPermission[] = [
  "store.read",
  "catalog.read",
  "catalog.write",
  "inventory.read",
  "inventory.write",
  "orders.read",
  "orders.write",
  "orders.cancel",
  "customers.read",
  "customers.write",
];

export const TENANT_ROLE_PERMISSIONS: Readonly<Record<TenantRole, ReadonlySet<TenantPermission>>> = {
  owner: new Set(TENANT_PERMISSIONS),
  manager: new Set(MANAGER),
  sales_associate: new Set(SALES_ASSOCIATE),
};

/**
 * Read-only set granted by an active platform support session (role_permissions row
 * 'support_viewer'; never assignable to a member).
 */
export const SUPPORT_SESSION_ROLE = "support_viewer" as const;
export const SUPPORT_SESSION_PERMISSIONS: ReadonlySet<TenantPermission> = new Set([
  "store.read",
  "catalog.read",
  "inventory.read",
  "orders.read",
  "customers.read",
  "marketing.read",
  "analytics.read",
]);

export const PLATFORM_PERMISSIONS = [
  "platform.tenants.read",
  "platform.tenants.manage",
  "platform.plans.manage",
  "platform.flags.manage",
  "platform.users.manage",
  "platform.audit.read",
  "platform.support.impersonate",
  "platform.settings.manage",
  "platform.usage.read",
  "platform.finance.read",
  "platform.finance.manage",
  "platform.partners.manage",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLES = ["super_admin", "support", "finance"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_PERMISSIONS: Readonly<Record<PlatformRole, ReadonlySet<PlatformPermission>>> = {
  super_admin: new Set(PLATFORM_PERMISSIONS),
  support: new Set(["platform.tenants.read", "platform.audit.read", "platform.support.impersonate", "platform.usage.read"]),
  finance: new Set(["platform.tenants.read", "platform.plans.manage", "platform.usage.read", "platform.finance.read", "platform.finance.manage"]),
};

export function tenantRoleCan(role: TenantRole, permission: TenantPermission): boolean {
  return TENANT_ROLE_PERMISSIONS[role].has(permission);
}

export function platformRoleCan(role: PlatformRole, permission: PlatformPermission): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role].has(permission);
}

export function isTenantPermission(v: string): v is TenantPermission {
  return (TENANT_PERMISSIONS as readonly string[]).includes(v);
}
