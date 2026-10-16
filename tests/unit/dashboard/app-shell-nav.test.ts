import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, type NavGroup } from "@/components/dashboard/nav";
import { ADMIN_NAV, adminNavFor } from "@/features/platform/nav";
import { NAV_ICONS } from "@/components/app-shell/icons";
import { activeGroupFor, activeHrefFor, breadcrumbsFor, flyoutTop, isSubmenu, navItemMatches, submenuId } from "@/components/app-shell/nav-tree";
import { SIDEBAR_COOKIE, parseSidebarCollapsed, sidebarCookie } from "@/components/app-shell/sidebar-cookie";
import type { PlatformPermission } from "@/lib/permissions/matrix";

const seller = DASHBOARD_NAV as NavGroup[];
const admin = ADMIN_NAV as unknown as NavGroup[];

/** App Router page file for a nav href (route groups like "(console)" are transparent). */
function pageExists(href: string): boolean {
  const app = path.join(process.cwd(), "src/app");
  if (href.startsWith("/admin")) return existsSync(path.join(app, "admin/(console)", href.slice("/admin".length), "page.tsx"));
  return existsSync(path.join(app, href, "page.tsx"));
}

describe.each([
  ["seller", seller],
  ["admin", admin],
])("%s nav tree", (_name, groups) => {
  const items = groups.flatMap((g) => g.items);

  it("links every item to a real page, once", () => {
    for (const i of items) expect(pageExists(i.href), i.href).toBe(true);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });

  it("gives every group and item a known icon and a unique label", () => {
    for (const g of groups) {
      expect(NAV_ICONS[g.icon ?? g.items[0]!.icon], g.label).toBeDefined();
      for (const i of g.items) expect(NAV_ICONS[i.icon], i.href).toBeDefined();
    }
    expect(new Set(groups.map((g) => g.label)).size).toBe(groups.length);
  });

  it("makes every multi-item group a submenu with its own group icon", () => {
    for (const g of groups.filter(isSubmenu)) expect(g.icon, g.label).toBeDefined();
  });
});

describe("seller nav", () => {
  it("has the expected submenus", () => {
    expect(seller.filter(isSubmenu).map((g) => g.label)).toEqual(["Catalog", "Sales", "Accounts", "Marketing", "Storefront", "Settings"]);
  });
});

describe("admin nav", () => {
  it("keeps group icons when filtering by permission and drops empty groups", () => {
    const groups = adminNavFor(new Set<PlatformPermission>(["platform.tenants.read"]));
    expect(groups.map((g) => g.label)).toEqual(["Overview", "Stores", "Billing & features"]);
    expect(groups.every((g) => g.icon)).toBe(true);
  });
});

describe("active item", () => {
  it("matches the console root only on itself", () => {
    expect(navItemMatches("/dashboard", "/dashboard", "/dashboard")).toBe(true);
    expect(navItemMatches("/dashboard/orders", "/dashboard", "/dashboard")).toBe(false);
    expect(navItemMatches("/dashboard/orders/abc", "/dashboard/orders", "/dashboard")).toBe(true);
    expect(navItemMatches("/dashboard/ordersx", "/dashboard/orders", "/dashboard")).toBe(false);
  });

  it("picks the longest matching href and its group", () => {
    expect(activeHrefFor("/dashboard/settings/team", seller, "/dashboard")).toBe("/dashboard/settings/team");
    expect(activeGroupFor("/dashboard/settings/team", seller)).toBe("Accounts");
    expect(activeHrefFor("/dashboard/settings", seller, "/dashboard")).toBe("/dashboard/settings");
    expect(activeGroupFor("/dashboard/settings", seller)).toBe("Settings");
    expect(activeHrefFor("/dashboard/products/new", seller, "/dashboard")).toBe("/dashboard/products");
    expect(activeHrefFor("/dashboard", seller, "/dashboard")).toBe("/dashboard");
    expect(activeHrefFor("/somewhere", seller, "/dashboard")).toBeNull();
    expect(activeGroupFor(null, seller)).toBeNull();
    expect(activeHrefFor("/admin/plans/new", admin, "/admin")).toBe("/admin/plans");
    expect(activeGroupFor("/admin/plans", admin)).toBe("Billing & features");
  });
});

describe("breadcrumbs", () => {
  it("builds group › item › sub-page", () => {
    expect(breadcrumbsFor("/dashboard/products/new", seller, "/dashboard")).toEqual([{ label: "Catalog" }, { label: "Products", href: "/dashboard/products" }, { label: "New" }]);
    expect(breadcrumbsFor("/dashboard/customers/0b0e1c3a-8a43-4c7e-9d38-4f0f6c2d9a11", seller, "/dashboard").at(-1)).toEqual({ label: "Details" });
    expect(breadcrumbsFor("/dashboard", seller, "/dashboard")).toEqual([{ label: "Dashboard", href: undefined }]);
    expect(breadcrumbsFor("/nope", seller, "/dashboard")).toEqual([]);
  });
});

describe("helpers", () => {
  it("builds stable submenu ids", () => {
    expect(submenuId("seller", "Billing & features")).toBe("nav-seller-billing-features");
  });

  it("keeps the flyout inside the viewport", () => {
    expect(flyoutTop(100, 200, 800)).toBe(100);
    expect(flyoutTop(700, 200, 800)).toBe(592);
    expect(flyoutTop(-20, 200, 800)).toBe(8);
    expect(flyoutTop(100, 900, 800)).toBe(8);
  });
});

describe("sidebar cookie", () => {
  it("parses only '1' as collapsed", () => {
    expect(parseSidebarCollapsed("1")).toBe(true);
    expect(parseSidebarCollapsed(" 1 ")).toBe(true);
    for (const v of ["0", "", "true", "yes", undefined, null]) expect(parseSidebarCollapsed(v)).toBe(false);
  });

  it("serialises a long-lived, site-wide, lax cookie per panel", () => {
    expect(sidebarCookie("seller", true)).toBe(`${SIDEBAR_COOKIE.seller}=1; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(sidebarCookie("admin", false)).toMatch(/^pc_sidebar_admin=0;/);
    expect(SIDEBAR_COOKIE.seller).not.toBe(SIDEBAR_COOKIE.admin);
  });
});
