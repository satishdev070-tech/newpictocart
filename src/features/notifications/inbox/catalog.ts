import type { PlatformPermission, TenantPermission } from "@/lib/permissions/matrix";

/**
 * In-app notification types (the bell). Pure data, safe for client components.
 *
 * Rows are written by DB triggers (supabase/migrations/20261016003000_in_app_notifications.sql);
 * `permission` here must match the permission the producer fans out on, so the preferences UI only
 * offers types a user can actually receive.
 */
export type NotificationScope = "tenant" | "platform";
export type NotificationTone = "accent" | "success" | "warning" | "error" | "info";
export type NotificationGroup = "orders" | "payments" | "inventory" | "customers" | "store" | "platform";

type TenantType = { scope: "tenant"; permission: TenantPermission };
type PlatformType = { scope: "platform"; permission: PlatformPermission };
export type NotificationTypeInfo = (TenantType | PlatformType) & { label: string; group: NotificationGroup; tone: NotificationTone };

export const NOTIFICATION_TYPES = {
  "order.new": { scope: "tenant", permission: "orders.read", label: "New orders", group: "orders", tone: "accent" },
  "order.cancelled": { scope: "tenant", permission: "orders.read", label: "Cancelled orders", group: "orders", tone: "error" },
  "order.returned": { scope: "tenant", permission: "orders.read", label: "Returned / RTO orders", group: "orders", tone: "warning" },
  "order.return_requested": { scope: "tenant", permission: "orders.read", label: "Return requests", group: "orders", tone: "warning" },
  "cart.recovered": { scope: "tenant", permission: "orders.read", label: "Recovered abandoned carts", group: "orders", tone: "success" },
  "payment.received": { scope: "tenant", permission: "orders.read", label: "Payments received", group: "payments", tone: "success" },
  "payment.failed": { scope: "tenant", permission: "orders.read", label: "Failed payments", group: "payments", tone: "error" },
  "stock.low": { scope: "tenant", permission: "inventory.read", label: "Low stock", group: "inventory", tone: "warning" },
  "stock.out": { scope: "tenant", permission: "inventory.read", label: "Sold out", group: "inventory", tone: "error" },
  "review.new": { scope: "tenant", permission: "reviews.moderate", label: "New reviews", group: "customers", tone: "info" },
  "customer.new": { scope: "tenant", permission: "customers.read", label: "New customers", group: "customers", tone: "info" },
  "plan.trial_expiring": { scope: "tenant", permission: "billing.manage", label: "Trial ending", group: "store", tone: "warning" },
  "plan.request_decided": { scope: "tenant", permission: "billing.manage", label: "Plan request decisions", group: "store", tone: "info" },
  "ai.credits_low": { scope: "tenant", permission: "marketing.write", label: "AI credits low", group: "store", tone: "warning" },
  "ai.credits_exhausted": { scope: "tenant", permission: "marketing.write", label: "AI credits used up", group: "store", tone: "error" },
  "domain.status": { scope: "tenant", permission: "domains.manage", label: "Domain verification", group: "store", tone: "info" },
  "domain.ssl": { scope: "tenant", permission: "domains.manage", label: "SSL certificate", group: "store", tone: "info" },
  "platform.signup": { scope: "platform", permission: "platform.users.manage", label: "New sign-ups", group: "platform", tone: "info" },
  "platform.store_created": { scope: "platform", permission: "platform.tenants.read", label: "New stores", group: "platform", tone: "accent" },
  "platform.store_published": { scope: "platform", permission: "platform.tenants.read", label: "Stores published", group: "platform", tone: "success" },
  "platform.plan_request": { scope: "platform", permission: "platform.tenants.manage", label: "Plan requests", group: "platform", tone: "warning" },
  // Reserved: produced through notifyPlatform() once these flows exist (no tables yet).
  "platform.apk_request": { scope: "platform", permission: "platform.tenants.manage", label: "App (APK) requests", group: "platform", tone: "info" },
  "platform.dispute": { scope: "platform", permission: "platform.tenants.manage", label: "Disputes", group: "platform", tone: "error" },
  "platform.payment_failed": { scope: "platform", permission: "platform.plans.manage", label: "Failed platform payments", group: "platform", tone: "error" },
  "platform.payout_failed": { scope: "platform", permission: "platform.plans.manage", label: "Failed payouts", group: "platform", tone: "error" },
} as const satisfies Record<string, NotificationTypeInfo>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  orders: "Orders",
  payments: "Payments",
  inventory: "Inventory",
  customers: "Customers & reviews",
  store: "Store & billing",
  platform: "Platform",
};

export function typeInfo(type: string): NotificationTypeInfo | null {
  return (NOTIFICATION_TYPES as Record<string, NotificationTypeInfo>)[type] ?? null;
}

export function typesForScope(scope: NotificationScope): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((t) => NOTIFICATION_TYPES[t].scope === scope);
}

export function groupsForScope(scope: NotificationScope): NotificationGroup[] {
  return [...new Set(typesForScope(scope).map((t) => NOTIFICATION_TYPES[t].group))];
}

export function typesInGroup(group: NotificationGroup): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((t) => NOTIFICATION_TYPES[t].group === group);
}

/** Types this user can receive (for the preferences form). */
export function receivableTypes(scope: NotificationScope, has: (permission: string) => boolean): NotificationType[] {
  return typesForScope(scope).filter((t) => has(NOTIFICATION_TYPES[t].permission));
}

/** One notification as the UI sees it. */
export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Only in-app paths are followed (the DB enforces the same). */
export function safeLink(link: string | null): string | null {
  return link && /^\/(dashboard|admin)(\/|\?|$)/.test(link) && !link.startsWith("//") ? link : null;
}

const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto", style: "short" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** "just now", "5 min. ago", "3 hr. ago", "yesterday", "4 days ago", then a date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return dayFmt.format(new Date(iso));
}
