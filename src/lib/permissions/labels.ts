import type { MembershipRole, TenantPermission, TenantRole } from "./matrix";

/** Display names and descriptions for system roles (pure; safe in client and server code). */
export const ROLE_INFO: Record<TenantRole, { label: string; description: string }> = {
  owner: { label: "Store Admin (Owner)", description: "The merchant who registered the store. Full access, including billing and ownership. Cannot be removed or changed by others." },
  manager: { label: "Manager", description: "Runs the store just below the owner: catalogue, orders, refunds, marketing, content, theme, settings, payments, domains and the team. No billing." },
  sales_associate: { label: "Sales Associate", description: "Day-to-day selling: orders, customers, products (view and edit) and stock. No settings, payments, domains or team." },
};

/** Labels for roles retired by the QA #3 migration, in case an old audit entry or row still names one. */
const LEGACY_ROLE_LABEL: Record<string, string> = {
  admin: "Manager",
  catalog_manager: "Manager",
  order_manager: "Manager",
  inventory_manager: "Manager",
  marketing_manager: "Manager",
  content_manager: "Manager",
  analyst: "Sales Associate",
  support_agent: "Sales Associate",
  staff: "Sales Associate",
  viewer: "Sales Associate",
};

export function roleLabel(role: MembershipRole | string, customName?: string | null): string {
  if (role === "custom") return customName ?? "Custom role";
  return ROLE_INFO[role as TenantRole]?.label ?? LEGACY_ROLE_LABEL[role] ?? role;
}

export type PermissionGroup = { key: string; label: string; permissions: { key: TenantPermission; label: string; description: string }[] };

/** Permissions grouped for the Roles & permissions editor. Every TENANT_PERMISSION appears once. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "store",
    label: "Store",
    permissions: [
      { key: "store.read", label: "View dashboard", description: "Open the dashboard and see store details." },
      { key: "settings.write", label: "Edit store settings", description: "Store profile, taxes, notifications and checkout options." },
      { key: "payments.manage", label: "Manage payments", description: "Connect payment providers and change payment settings." },
      { key: "domains.manage", label: "Manage domains", description: "Add, verify and remove custom domains." },
      { key: "billing.manage", label: "Billing", description: "Plan and billing. Store Owner only." },
    ],
  },
  {
    key: "catalog",
    label: "Products & catalogue",
    permissions: [
      { key: "catalog.read", label: "View products", description: "See products, collections, categories and size charts." },
      { key: "catalog.write", label: "Create & edit products", description: "Create and edit products, variants, images, collections and categories." },
      { key: "catalog.publish", label: "Publish products", description: "Make products live on the storefront." },
      { key: "catalog.delete", label: "Delete products", description: "Permanently delete products, collections and categories." },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    permissions: [
      { key: "inventory.read", label: "View inventory", description: "See stock levels and movements." },
      { key: "inventory.write", label: "Adjust inventory", description: "Change stock quantities and low-stock thresholds." },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    permissions: [
      { key: "orders.read", label: "View orders", description: "See orders, returns and invoices." },
      { key: "orders.write", label: "Update orders", description: "Fulfil, add tracking, update returns and notes." },
      { key: "orders.cancel", label: "Cancel orders", description: "Cancel orders and release reserved stock." },
      { key: "orders.refund", label: "Refund orders", description: "Issue full or partial refunds." },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    permissions: [
      { key: "customers.read", label: "View customers", description: "See customer profiles and order history." },
      { key: "customers.write", label: "Edit customers", description: "Edit customer notes and tags; export customers." },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    permissions: [
      { key: "marketing.read", label: "View coupons", description: "See discount codes and their usage." },
      { key: "marketing.write", label: "Manage coupons", description: "Create, edit and disable discount codes." },
      { key: "reviews.moderate", label: "Moderate reviews", description: "Approve, reject and reply to product reviews." },
    ],
  },
  {
    key: "content",
    label: "Content & theme",
    permissions: [
      { key: "content.write", label: "Manage content", description: "Pages, blog posts, menus, FAQs and store locations." },
      { key: "theme.edit", label: "Edit theme", description: "Customise the theme and save drafts." },
      { key: "theme.publish", label: "Publish theme", description: "Make theme changes live and roll back versions." },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    permissions: [{ key: "analytics.read", label: "View analytics", description: "Sales, traffic and conversion reports." }],
  },
  {
    key: "team",
    label: "Team & roles",
    permissions: [
      { key: "members.read", label: "View team", description: "See who has access to the store." },
      { key: "members.manage", label: "Manage team", description: "Invite, deactivate and remove members; change their roles." },
      { key: "roles.manage", label: "Manage roles", description: "Create and edit custom roles." },
    ],
  },
];
