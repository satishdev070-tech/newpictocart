import type { PlatformPermission } from "@/lib/permissions/matrix";
import type { NavIconName } from "@/components/app-shell/icons";

/**
 * Super-admin navigation (single source). Items are hidden when the platform role lacks the
 * permission; each page also calls requirePlatform(permission) and RLS enforces the same keys.
 */
export type AdminNavItem = { href: string; label: string; permission: PlatformPermission; icon: NavIconName };
export type AdminNavGroup = { label: string; icon?: NavIconName; items: AdminNavItem[] };

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: "Overview",
    icon: "dashboard",
    items: [{ href: "/admin", label: "Dashboard", permission: "platform.tenants.read", icon: "dashboard" }],
  },
  {
    label: "Stores",
    icon: "stores",
    items: [
      { href: "/admin/stores", label: "Stores", permission: "platform.tenants.read", icon: "stores" },
      { href: "/admin/domains", label: "Domains", permission: "platform.tenants.read", icon: "domains" },
      { href: "/admin/support", label: "Support sessions", permission: "platform.support.impersonate", icon: "support" },
    ],
  },
  {
    label: "Billing & features",
    icon: "billing",
    items: [
      { href: "/admin/plan-requests", label: "Plan requests", permission: "platform.tenants.read", icon: "plans" },
      { href: "/admin/plans", label: "Plans", permission: "platform.plans.manage", icon: "plans" },
      { href: "/admin/flags", label: "Feature flags", permission: "platform.flags.manage", icon: "flags" },
    ],
  },
  {
    label: "Monitoring",
    icon: "monitoring",
    items: [
      { href: "/admin/usage", label: "Usage & storage", permission: "platform.usage.read", icon: "usage" },
      { href: "/admin/audit", label: "Audit log", permission: "platform.audit.read", icon: "audit" },
      { href: "/admin/integrations", label: "Store integrations", permission: "platform.settings.manage", icon: "integrations" },
      { href: "/admin/social-apps", label: "Social apps", permission: "platform.settings.manage", icon: "integrations" },
      { href: "/admin/health", label: "Platform health", permission: "platform.settings.manage", icon: "activity" },
    ],
  },
  {
    label: "Platform",
    icon: "settings",
    items: [
      { href: "/admin/users", label: "Platform users", permission: "platform.users.manage", icon: "users" },
      { href: "/admin/landing", label: "Landing page", permission: "platform.settings.manage", icon: "pages" },
      { href: "/admin/themes", label: "Themes", permission: "platform.settings.manage", icon: "themes" },
      { href: "/admin/product-types", label: "Product types", permission: "platform.settings.manage", icon: "products" },
      { href: "/admin/media", label: "Media library", permission: "platform.settings.manage", icon: "media" },
      { href: "/admin/branding", label: "Branding & analytics", permission: "platform.settings.manage", icon: "themes" },
      { href: "/admin/sign-in", label: "Sign-in & checkout", permission: "platform.settings.manage", icon: "users" },
      { href: "/admin/email", label: "Email (Resend)", permission: "platform.settings.manage", icon: "notifications" },
      { href: "/admin/settings", label: "Settings", permission: "platform.settings.manage", icon: "settings" },
    ],
  },
];

export function adminNavFor(permissions: ReadonlySet<PlatformPermission>): AdminNavGroup[] {
  return ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => permissions.has(i.permission)) })).filter((g) => g.items.length > 0);
}

/** "/admin" is active only on itself; other items also match their sub-pages. */
export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  // Store detail pages live under /admin/tenants/{id}.
  if (href === "/admin/stores" && pathname.startsWith("/admin/tenants")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
