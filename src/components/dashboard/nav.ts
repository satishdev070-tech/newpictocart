import type { TenantPermission } from "@/lib/permissions/matrix";
import type { NavIconName } from "@/components/app-shell/icons";

/**
 * Seller dashboard navigation (single source). Each module's pages live under the href.
 * Items are hidden when the member's role lacks the permission; the page itself also
 * checks with requireTenantPermission(), and RLS enforces it in the database.
 */
export type NavItem = { href: string; label: string; permission: string; icon: NavIconName; /** English label when `label` is translated (search matches both). */ alt?: string };
/**
 * A sidebar section. Groups with more than one item render as a collapsible submenu headed by `icon`.
 * `id` is a stable, language-independent key (defaults to `label`).
 */
export type NavGroup = { id?: string; label: string; icon?: NavIconName; items: NavItem[] };

type TenantNavItem = NavItem & { permission: TenantPermission };

export const DASHBOARD_NAV: { label: string; icon: NavIconName; items: TenantNavItem[] }[] = [
  {
    label: "Overview",
    icon: "dashboard",
    items: [{ href: "/dashboard", label: "Dashboard", permission: "store.read", icon: "dashboard" }],
  },
  {
    label: "Catalog",
    icon: "products",
    items: [
      { href: "/dashboard/products", label: "Products", permission: "catalog.read", icon: "products" },
      { href: "/dashboard/collections", label: "Collections", permission: "catalog.read", icon: "collections" },
      { href: "/dashboard/categories", label: "Categories", permission: "catalog.read", icon: "categories" },
      { href: "/dashboard/inventory", label: "Inventory", permission: "inventory.read", icon: "inventory" },
      { href: "/dashboard/size-charts", label: "Size charts", permission: "catalog.read", icon: "sizeCharts" },
    ],
  },
  {
    label: "Sales",
    icon: "orders",
    items: [
      // Several labels alias existing pages (Pic To Cart parity); no separate route yet.
      { href: "/dashboard/orders", label: "Orders", permission: "orders.read", icon: "orders" },
      { href: "/dashboard/returns", label: "Returns", permission: "orders.read", icon: "returns" },
      { href: "/dashboard/returns", label: "Exchanges", permission: "orders.read", icon: "redirects" },
      { href: "/dashboard/payments", label: "Refunds", permission: "orders.read", icon: "taxes" },
      { href: "/dashboard/orders", label: "Shipments", permission: "orders.read", icon: "shipping" },
      { href: "/dashboard/reviews", label: "Reviews", permission: "reviews.moderate", icon: "reviews" },
      { href: "/dashboard/customers", label: "My Customers", permission: "customers.read", icon: "customers" },
      { href: "/dashboard/content/messages", label: "Contact Messages", permission: "content.write", icon: "inbox" },
      { href: "/dashboard/discounts", label: "Coupons", permission: "marketing.read", icon: "coupons" },
      { href: "/dashboard/payments", label: "Payments", permission: "orders.read", icon: "payments" },
    ],
  },
  {
    label: "Accounts",
    icon: "accounts",
    items: [
      { href: "/dashboard/settings/team", label: "Team", permission: "members.read", icon: "team" },
      { href: "/dashboard/settings/roles", label: "Roles & permissions", permission: "roles.manage", icon: "roles" },
      { href: "/dashboard/settings/plan", label: "Plan & billing", permission: "store.read", icon: "billing" },
    ],
  },
  {
    label: "Marketing",
    icon: "social",
    items: [
      { href: "/dashboard/marketing/social", label: "Social", permission: "marketing.read", icon: "social" },
      { href: "/dashboard/marketing/inbox", label: "Inbox", permission: "marketing.read", icon: "inbox" },
      { href: "/dashboard/marketing/neural-pulse", label: "Neural Pulse", permission: "marketing.read", icon: "ai" },
      { href: "/dashboard/marketing/google", label: "Google Business", permission: "marketing.read", icon: "gbp" },
      { href: "/dashboard/marketing/creative", label: "Creative studio", permission: "marketing.read", icon: "creative" },
      { href: "/dashboard/settings/seo", label: "SEO", permission: "store.read", icon: "seo" },
    ],
  },
  {
    label: "Storefront",
    icon: "themes",
    items: [
      { href: "/dashboard/themes", label: "Theme marketplace", permission: "theme.edit", icon: "themes" },
      { href: "/dashboard/theme", label: "Theme editor", permission: "theme.edit", icon: "theme" },
      { href: "/dashboard/media", label: "Media", permission: "store.read", icon: "media" },
      { href: "/dashboard/content/pages", label: "Pages", permission: "content.write", icon: "pages" },
      { href: "/dashboard/content/menus", label: "Menus", permission: "content.write", icon: "menus" },
      { href: "/dashboard/content/blog", label: "Blog", permission: "content.write", icon: "blog" },
      { href: "/dashboard/content/faqs", label: "FAQs", permission: "content.write", icon: "faqs" },
      { href: "/dashboard/content/locations", label: "Store locations", permission: "content.write", icon: "locations" },
      { href: "/dashboard/content/redirects", label: "Redirects", permission: "content.write", icon: "redirects" },
      { href: "/dashboard/settings/domains", label: "Domains", permission: "store.read", icon: "domains" },
    ],
  },
  {
    label: "Analytics",
    icon: "analytics",
    items: [{ href: "/dashboard/analytics", label: "Analytics", permission: "analytics.read", icon: "analytics" }],
  },
  {
    label: "Settings",
    icon: "settings",
    items: [
      { href: "/dashboard/settings", label: "General", permission: "store.read", icon: "settings" },
      { href: "/dashboard/wallet", label: "AI Wallet", permission: "marketing.read", icon: "billing" },
      { href: "/dashboard/settings/payments", label: "Payment methods", permission: "payments.manage", icon: "payments" },
      { href: "/dashboard/settings/checkout", label: "Checkout", permission: "store.read", icon: "checkout" },
      { href: "/dashboard/settings/shipping", label: "Shipping & COD", permission: "store.read", icon: "shipping" },
      { href: "/dashboard/settings/taxes", label: "Taxes", permission: "settings.write", icon: "taxes" },
      { href: "/dashboard/settings/notifications", label: "Notifications", permission: "settings.write", icon: "notifications" },
      { href: "/dashboard/settings/security", label: "Security & activity", permission: "members.manage", icon: "roles" },
    ],
  },
];
