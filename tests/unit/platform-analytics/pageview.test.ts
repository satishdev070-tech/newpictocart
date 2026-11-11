import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTrackablePath, normalizePagePath, normalizeReferrer, parsePageview } from "@/features/platform-analytics/pageview";
import { pagesPerVisit, parseTrafficReport, trafficCsvRows } from "@/features/platform-analytics/report";
import { extractMetaPixelId, parsePublicConfig, PUBLIC_CONFIG_KEYS } from "@/features/platform/public-config";
import { parseSettingValue } from "@/features/platform/settings-registry";
import { ADMIN_NAV } from "@/features/platform/nav";

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261111007300_platform_page_views.sql", import.meta.url), "utf8");
const SID = "0b8a3f9e-6c1d-4f2a-9b7e-3d5c1a2b4e6f";

describe("page view beacon parsing", () => {
  it("keeps only the path (no query or fragment)", () => {
    expect(normalizePagePath("/pricing?utm=x#top")).toBe("/pricing");
    expect(normalizePagePath("/reset-password?code=secret")).toBe("/reset-password");
    for (const bad of ["pricing", "//evil.com", "/a b", "/" + "x".repeat(300), 42, null]) expect(normalizePagePath(bad)).toBeNull();
  });

  it("reduces referrers to origin + path", () => {
    expect(normalizeReferrer("https://www.google.com/search?q=pictocart")).toBe("https://www.google.com/search");
    expect(normalizeReferrer("android-app://com.google.android.googlequicksearchbox/")).toBe("android-app://com.google.android.googlequicksearchbox/");
    for (const bad of ["", "javascript:alert(1)", "not a url", null]) expect(normalizeReferrer(bad)).toBeNull();
  });

  it("requires a uuid session id and a valid path", () => {
    expect(parsePageview({ sid: SID, path: "/", ref: "" })).toEqual({ sid: SID, path: "/", referrer: null });
    expect(parsePageview({ sid: "abc", path: "/" })).toBeNull();
    expect(parsePageview({ sid: SID, path: "nope" })).toBeNull();
    expect(parsePageview([SID])).toBeNull();
  });

  it("never counts admin, API, store or dashboard paths", () => {
    expect(isTrackablePath("/")).toBe(true);
    expect(isTrackablePath("/seller/login")).toBe(true);
    for (const p of ["/admin", "/admin/analytics", "/api/x", "/_next/x", "/store/acme", "/dashboard"]) expect(isTrackablePath(p), p).toBe(false);
  });
});

describe("traffic report", () => {
  const json = {
    visitors: 1398,
    views: 2554,
    visitors_today: 1,
    views_today: 3,
    daily: [{ day: "2026-11-10", visitors: 2, views: 4 }],
    top_pages: [{ path: "/", views: 310, visitors: 246 }],
    top_referrers: [{ referrer: "(direct)", views: 1877, visitors: 924 }],
  };

  it("parses the RPC payload and computes pages per visit", () => {
    const r = parseTrafficReport(json);
    expect(r).toMatchObject({ visitors: 1398, views: 2554, visitorsToday: 1, viewsToday: 3 });
    expect(r.topPages[0]).toEqual({ key: "/", views: 310, visitors: 246 });
    expect(r.topReferrers[0]!.key).toBe("(direct)");
    expect(pagesPerVisit(r)).toBe(1.83);
    expect(pagesPerVisit({ visitors: 0, views: 5 })).toBe(0);
    expect(parseTrafficReport(null)).toMatchObject({ visitors: 0, daily: [], topPages: [] });
  });

  it("CSV covers totals, days, pages and referrers", () => {
    const rows = trafficCsvRows(parseTrafficReport(json));
    expect(rows.map((r) => r[0])).toEqual(["Total", "Daily", "Top page", "Top referrer"]);
  });
});

describe("Meta Pixel and GA settings", () => {
  it("extracts only the numeric pixel id from an id or the base code", () => {
    expect(extractMetaPixelId("1381937640384459")).toBe("1381937640384459");
    const base = `<!-- Meta Pixel Code --><script>!function(f,b,e,v,n,t,s){}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '1381937640384459');fbq('track', 'PageView');</script><noscript><img src="https://www.facebook.com/tr?id=1381937640384459&ev=PageView&noscript=1"/></noscript>`;
    expect(extractMetaPixelId(base)).toBe("1381937640384459");
    for (const bad of ["123", "<script>alert(1)</script>", "", null]) expect(extractMetaPixelId(bad)).toBeNull();
  });

  it("registry stores the id only, or rejects", () => {
    expect(parseSettingValue(PUBLIC_CONFIG_KEYS.metaPixel, "fbq('init', '1381937640384459')")).toEqual({ ok: true, value: "1381937640384459" });
    expect(parseSettingValue(PUBLIC_CONFIG_KEYS.metaPixel, "")).toEqual({ ok: true, value: null });
    expect(parseSettingValue(PUBLIC_CONFIG_KEYS.metaPixel, "<script>x</script>").ok).toBe(false);
    expect(parseSettingValue(PUBLIC_CONFIG_KEYS.ga4Enabled, undefined)).toEqual({ ok: true, value: false });
  });

  it("switches turn tags off without losing the stored ids", () => {
    const rows = [
      { key: PUBLIC_CONFIG_KEYS.ga4, value: "G-66HS2SH61E" },
      { key: PUBLIC_CONFIG_KEYS.metaPixel, value: "1381937640384459" },
    ];
    expect(parsePublicConfig(rows)).toMatchObject({ ga4Id: "G-66HS2SH61E", metaPixelId: "1381937640384459", firstPartyAnalytics: true });
    const off = parsePublicConfig([...rows, { key: PUBLIC_CONFIG_KEYS.ga4Enabled, value: false }, { key: PUBLIC_CONFIG_KEYS.metaPixelEnabled, value: false }, { key: PUBLIC_CONFIG_KEYS.firstParty, value: false }]);
    expect(off).toMatchObject({ ga4Id: null, metaPixelId: null, firstPartyAnalytics: false });
  });
});

describe("navigation and migration", () => {
  it("Analytics is a Super Admin nav item", () => {
    const item = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === "/admin/analytics");
    expect(item).toMatchObject({ label: "Analytics", permission: "platform.settings.manage" });
  });

  it("locks page views: staff read only, inserts via the validated RPC", () => {
    expect(MIGRATION).toContain("enable row level security");
    expect(MIGRATION).toContain("revoke all on public.platform_page_views from anon, authenticated;");
    expect(MIGRATION).not.toMatch(/grant (insert|all)[^;]* on public\.platform_page_views to (anon|authenticated)/);
    expect(MIGRATION).toContain("grant execute on function public.record_platform_page_view(uuid, text, text, text) to anon");
    expect(MIGRATION).not.toMatch(/grant execute on function public\.platform_traffic_report[^;]*anon/);
    expect(MIGRATION).toContain("app.has_platform_permission('platform.settings.manage')");
  });
});
