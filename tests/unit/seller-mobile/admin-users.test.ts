import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_TYPE_LABEL, toDirectoryUser, userDirectoryFilterSchema, type DirectoryRow } from "@/features/platform-users/schemas";

const row = (patch: Partial<DirectoryRow> = {}): DirectoryRow => ({
  user_id: "00000000-0000-4000-a000-000000000001",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  display_name: "Asha",
  created_at: "2026-11-01T00:00:00Z",
  last_sign_in_at: null,
  email_confirmed: true,
  platform_role: null,
  stores: [],
  customer_stores: 0,
  ...patch,
});
const store = (websiteType?: string) => ({ tenantId: "t1", name: "Aangan", slug: "aangan", role: "owner", status: "active", theme: null, ...(websiteType ? { websiteType } : {}) });

describe("user directory site filter", () => {
  it("accepts the two site types and drops anything else", () => {
    expect(userDirectoryFilterSchema.parse({ site: "INFORMATIVE" }).site).toBe("INFORMATIVE");
    expect(userDirectoryFilterSchema.parse({ site: "ONLINE_STORE" }).site).toBe("ONLINE_STORE");
    expect(userDirectoryFilterSchema.parse({ site: "blog" }).site).toBeUndefined();
    expect(userDirectoryFilterSchema.parse({}).site).toBeUndefined();
  });
  it("labels the site types", () => {
    expect(SITE_TYPE_LABEL).toEqual({ ONLINE_STORE: "Online Store", INFORMATIVE: "Informative Website" });
  });
});

describe("directory row mapping", () => {
  it("maps a v2 row with site types and WhatsApp verification", () => {
    const u = toDirectoryUser(row({ phone_verified: true, site_types: ["INFORMATIVE", "ONLINE_STORE"], stores: [store("ONLINE_STORE"), store("INFORMATIVE")] }));
    expect(u.phoneVerified).toBe(true);
    expect(u.siteTypes).toEqual(["ONLINE_STORE", "INFORMATIVE"]);
    expect(u.stores.map((s) => s.websiteType)).toEqual(["ONLINE_STORE", "INFORMATIVE"]);
    expect(u.types).toEqual(["seller"]);
  });
  it("defaults websiteType to ONLINE_STORE and derives site types on a v1 row", () => {
    const u = toDirectoryUser(row({ stores: [store(), store("WEIRD")] }));
    expect(u.phoneVerified).toBe(false);
    expect(u.stores.every((s) => s.websiteType === "ONLINE_STORE")).toBe(true);
    expect(u.siteTypes).toEqual(["ONLINE_STORE"]);
  });
  it("handles shoppers and junk store JSON", () => {
    const u = toDirectoryUser(row({ stores: "nope", customer_stores: 2, site_types: [] }));
    expect(u.stores).toEqual([]);
    expect(u.siteTypes).toEqual([]);
    expect(u.types).toEqual(["customer"]);
  });
});

describe("migration 9300 platform_user_directory_v2", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261127009300_admin_user_directory_v2.sql"), "utf8");
  const sig = "public.platform_user_directory_v2(text, text, uuid, text, integer, integer)";
  it("is granted to authenticated only", () => {
    expect(sql).toContain(`revoke all on function ${sig} from public, anon;`);
    expect(sql).toContain(`grant execute on function ${sig} to authenticated;`);
  });
  it("checks the platform permission and is security definer with an empty search_path", () => {
    expect(sql).toContain("app.has_platform_permission('platform.users.manage')");
    expect(sql).toMatch(/security definer set search_path = ''/);
  });
  it("searches phone on digits and the last 10 digits, and filters by site type", () => {
    expect(sql).toContain("regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g')");
    expect(sql).toContain("right(t.phone_digits, 10) = right(v_digits, 10)");
    expect(sql).toContain("p_site_type = any(t.sites)");
    expect(sql).toContain("'websiteType', coalesce(t.website_type, 'ONLINE_STORE')");
  });
});
