import type { TourId } from "./routes";

/**
 * Tour steps per page (loaded only with the tour overlay). `target` is a `data-tour` id, or a
 * list tried in order (first one on screen wins); a step with no target is a centred message.
 * A step whose target is missing or hidden (permissions, empty states, mobile) is skipped.
 * Titles and text live in ./text/<locale>.ts under the same tour and step ids.
 */
export type TourStep = { id: string; target?: string | readonly string[] };

const LIST = ["table", "empty"] as const;

export const TOURS: Record<TourId, readonly TourStep[]> = {
  home: [
    { id: "welcome" },
    { id: "nav", target: "nav" },
    { id: "search", target: "search" },
    { id: "setup", target: "setup" },
    { id: "kpis", target: "kpis" },
    { id: "storeLink", target: "page-actions" },
    { id: "help", target: "tour-help" },
    { id: "account", target: "account" },
  ],
  products: [
    { id: "actions", target: "page-actions" },
    { id: "filters", target: "filters" },
    { id: "list", target: LIST },
  ],
  productNew: [
    { id: "basics", target: "product-basics" },
    { id: "variants", target: "product-variants" },
    { id: "organisation", target: "product-organisation" },
    { id: "status", target: "product-status" },
  ],
  productEdit: [
    { id: "basics", target: "product-basics" },
    { id: "variants", target: "product-variants" },
    { id: "status", target: "product-status" },
  ],
  orders: [
    { id: "intro", target: "page-header" },
    { id: "filters", target: "filters" },
    { id: "list", target: LIST },
  ],
  orderDetail: [
    { id: "items", target: "order-items" },
    { id: "fulfilment", target: "order-fulfilment" },
    { id: "payments", target: "order-payments" },
    { id: "customer", target: "order-customer" },
    { id: "timeline", target: "order-timeline" },
  ],
  categories: [
    { id: "add", target: "category-add" },
    { id: "list", target: ["category-list", "empty"] },
  ],
  collections: [
    { id: "create", target: "page-actions" },
    { id: "list", target: LIST },
  ],
  inventory: [
    { id: "stats", target: "inventory-stats" },
    { id: "filters", target: "filters" },
    { id: "list", target: LIST },
  ],
  settings: [
    { id: "menu", target: "settings-nav" },
    { id: "details", target: "page-header" },
    { id: "language", target: "language" },
  ],
  payments: [
    { id: "status", target: "payment-status" },
    { id: "gateways", target: "payment-gateways" },
  ],
  shipping: [
    { id: "couriers", target: "couriers" },
    { id: "rates", target: "shipping-rates" },
    { id: "pincodes", target: "pincode-rules" },
    { id: "cod", target: "cod" },
  ],
  checkout: [
    { id: "options", target: "checkout-options" },
    { id: "signin", target: "checkout-signin" },
  ],
  domains: [
    { id: "platform", target: "domain-platform" },
    { id: "custom", target: "domain-custom" },
  ],
  seo: [
    { id: "form", target: "seo-form" },
    { id: "generated", target: "seo-generated" },
  ],
  team: [
    { id: "invite", target: "page-actions" },
    { id: "members", target: ["team-members", "empty"] },
    { id: "roles", target: "team-roles" },
  ],
  themes: [
    { id: "current", target: "theme-current" },
    { id: "customize", target: "page-actions" },
    { id: "browse", target: "theme-browse" },
  ],
  themeEditor: [
    { id: "tools", target: "builder-tools" },
    { id: "canvas", target: "builder-canvas" },
    { id: "publish", target: "builder-topbar" },
  ],
  discounts: [
    { id: "create", target: "page-actions" },
    { id: "list", target: LIST },
  ],
  social: [
    { id: "tabs", target: "social-tabs" },
    { id: "week", target: "social-week" },
    { id: "accounts", target: "social-accounts" },
  ],
};

/** Target ids of a step, in the order they are tried. */
export function stepTargets(step: TourStep): readonly string[] {
  return step.target === undefined ? [] : typeof step.target === "string" ? [step.target] : step.target;
}
