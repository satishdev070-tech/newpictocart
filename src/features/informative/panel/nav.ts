import type { NavGroup, NavItem } from "@/components/dashboard/nav";
import type { TenantPermission } from "@/lib/permissions/matrix";

/**
 * Informative panel sidebar (informativeNavConfig in the plan). The store's DASHBOARD_NAV is not
 * touched: the panel has its own layout and passes this config to the same AppShell. Items are
 * hidden when the member's role lacks the permission; pages and RLS check again.
 */
type Item = NavItem & { permission: TenantPermission };

export const INFORMATIVE_NAV: { id: string; label: string; icon: NavGroup["icon"]; items: Item[] }[] = [
  { id: "overview", label: "Overview", icon: "dashboard", items: [{ href: "/informative/dashboard", label: "Dashboard", permission: "store.read", icon: "dashboard" }] },
  {
    id: "content",
    label: "Content",
    icon: "pages",
    items: [
      { href: "/informative/services", label: "Services", permission: "store.read", icon: "products" },
      { href: "/informative/pages", label: "Pages", permission: "store.read", icon: "pages" },
      { href: "/informative/gallery", label: "Gallery", permission: "store.read", icon: "media" },
      { href: "/informative/team", label: "Team", permission: "store.read", icon: "team" },
      { href: "/informative/testimonials", label: "Testimonials", permission: "store.read", icon: "reviews" },
      { href: "/informative/faqs", label: "FAQs", permission: "store.read", icon: "faqs" },
    ],
  },
  { id: "leads", label: "Leads", icon: "inbox", items: [{ href: "/informative/enquiries", label: "Enquiries", permission: "customers.read", icon: "inbox" }] },
  {
    id: "website",
    label: "Website",
    icon: "themes",
    items: [
      { href: "/informative/appearance", label: "Appearance", permission: "theme.edit", icon: "themes" },
      { href: "/informative/business", label: "Business info", permission: "settings.write", icon: "stores" },
      { href: "/informative/seo", label: "SEO", permission: "settings.write", icon: "seo" },
      { href: "/informative/domain", label: "Domain", permission: "store.read", icon: "domains" },
      { href: "/informative/settings", label: "Settings", permission: "settings.write", icon: "settings" },
    ],
  },
];

export function informativeNavFor(permissions: ReadonlySet<TenantPermission>): NavGroup[] {
  return INFORMATIVE_NAV.map((g) => ({ ...g, items: g.items.filter((i) => permissions.has(i.permission)) })).filter((g) => g.items.length);
}
