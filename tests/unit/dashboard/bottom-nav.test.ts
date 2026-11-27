import { describe, expect, it } from "vitest";
import { activeBottomHref, bottomNavItems } from "@/components/app-shell/nav-tree";
import { DASHBOARD_NAV, SELLER_BOTTOM_NAV, type NavGroup } from "@/components/dashboard/nav";

const groups: NavGroup[] = DASHBOARD_NAV.map((g) => ({ label: g.label, icon: g.icon, items: g.items }));

describe("seller bottom nav", () => {
  it("takes Dashboard, Products, Categories, Collections from the nav in that order", () => {
    expect(bottomNavItems(groups, SELLER_BOTTOM_NAV).map((i) => i.label)).toEqual(["Dashboard", "Products", "Categories", "Collections"]);
  });

  it("drops tabs the member cannot open (filtered nav) and keeps translated labels", () => {
    const limited: NavGroup[] = [
      { label: "Overview", items: [{ href: "/dashboard", label: "डैशबोर्ड", permission: "store.read", icon: "dashboard" }] },
      { label: "Sales", items: [{ href: "/dashboard/orders", label: "Orders", permission: "orders.read", icon: "orders" }] },
    ];
    expect(bottomNavItems(limited, SELLER_BOTTOM_NAV)).toEqual([{ href: "/dashboard", label: "डैशबोर्ड", icon: "dashboard" }]);
  });

  it("highlights the tab for sub-pages; home only on itself; nothing (More) elsewhere", () => {
    const items = bottomNavItems(groups, SELLER_BOTTOM_NAV);
    expect(activeBottomHref("/dashboard", items, "/dashboard")).toBe("/dashboard");
    expect(activeBottomHref("/dashboard/products/new", items, "/dashboard")).toBe("/dashboard/products");
    expect(activeBottomHref("/dashboard/collections/abc", items, "/dashboard")).toBe("/dashboard/collections");
    expect(activeBottomHref("/dashboard/orders", items, "/dashboard")).toBeNull();
  });
});
