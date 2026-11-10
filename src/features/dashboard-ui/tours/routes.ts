/**
 * Which seller-panel pages have a guided tour (pure, unit tested). This file is the only tour
 * code in the always-loaded bundle: the steps, their text and the overlay load on demand.
 */
export const TOUR_ROUTES = {
  home: "/dashboard",
  products: "/dashboard/products",
  productNew: "/dashboard/products/new",
  productEdit: "/dashboard/products/[id]",
  orders: "/dashboard/orders",
  orderDetail: "/dashboard/orders/[id]",
  categories: "/dashboard/categories",
  collections: "/dashboard/collections",
  inventory: "/dashboard/inventory",
  settings: "/dashboard/settings",
  payments: "/dashboard/settings/payments",
  shipping: "/dashboard/settings/shipping",
  checkout: "/dashboard/settings/checkout",
  domains: "/dashboard/settings/domains",
  seo: "/dashboard/settings/seo",
  team: "/dashboard/settings/team",
  themes: "/dashboard/themes",
  themeEditor: "/dashboard/theme",
  discounts: "/dashboard/discounts",
  social: "/dashboard/marketing/social",
} as const;

export type TourId = keyof typeof TOUR_ROUTES;
export const TOUR_IDS = Object.keys(TOUR_ROUTES) as TourId[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tour for a pathname. `[id]` matches one UUID segment, so "/products/import" has no tour. */
export function tourForPath(pathname: string): TourId | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const segs = path.split("/");
  for (const id of TOUR_IDS) {
    const pattern = TOUR_ROUTES[id].split("/");
    if (pattern.length === segs.length && pattern.every((p, i) => (p === "[id]" ? UUID.test(segs[i]!) : p === segs[i]))) return id;
  }
  return null;
}

const DONE_PREFIX = "pc_tour_done:";

/** Whether this browser already finished or closed a tour (localStorage; false when unavailable). */
export function tourDone(id: TourId): boolean {
  try {
    return localStorage.getItem(DONE_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

export function markTourDone(id: TourId): void {
  try {
    localStorage.setItem(DONE_PREFIX + id, "1");
  } catch {
    /* storage unavailable: the tour may show again next visit */
  }
}
