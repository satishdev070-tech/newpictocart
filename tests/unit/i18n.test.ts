import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, LOCALE_NAMES, localeCookie, parseLocale } from "@/lib/i18n/config";
import { MESSAGES, createT, format } from "@/lib/i18n/translate";
import { DASHBOARD_NAV } from "@/components/dashboard/nav";
import { localizeNav } from "@/components/dashboard/nav-i18n";

/** Dotted keys of a nested message object, with placeholder names per key. */
function flatten(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("locale cookie", () => {
  it("parses known codes, regions and case; anything else is English", () => {
    expect(parseLocale("hi")).toBe("hi");
    expect(parseLocale(" HI-in ")).toBe("hi");
    expect(parseLocale("hi_IN")).toBe("hi");
    expect(parseLocale("en")).toBe("en");
    for (const junk of [undefined, null, "", "fr", "hindi", "<script>", "mr"]) expect(parseLocale(junk)).toBe(DEFAULT_LOCALE);
  });

  it("writes a year-long, site-wide, Lax cookie that parses back", () => {
    const c = localeCookie("hi");
    expect(c).toMatch(new RegExp(`^${LOCALE_COOKIE}=hi;`));
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(parseLocale(c.split(";")[0]!.split("=")[1])).toBe("hi");
  });

  it("names every locale", () => {
    for (const l of LOCALES) expect(LOCALE_NAMES[l]).toBeTruthy();
  });
});

describe("dictionaries", () => {
  const en = flatten(MESSAGES.en);

  it.each(LOCALES)("%s has exactly the English keys, non-empty, same placeholders", (l) => {
    const msgs = flatten(MESSAGES[l]);
    expect([...msgs.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [k, v] of msgs) {
      expect(v.trim(), k).not.toBe("");
      expect(placeholders(v), k).toEqual(placeholders(en.get(k)!));
    }
  });

  it("translates every dashboard nav group and item", () => {
    for (const l of LOCALES) {
      const groups: Record<string, string> = MESSAGES[l].nav.groups;
      const items: Record<string, string> = MESSAGES[l].nav.items;
      for (const g of DASHBOARD_NAV) {
        expect(groups[g.label], `${l} group ${g.label}`).toBeTruthy();
        for (const i of g.items) expect(items[i.href], `${l} ${i.href}`).toBeTruthy();
      }
    }
  });

  it("localizes the nav but keeps English ids for DOM ids and search", () => {
    const hi = localizeNav(DASHBOARD_NAV, MESSAGES.hi.nav);
    const catalog = hi.find((g) => g.id === "Catalog")!;
    expect(catalog.label).toBe(MESSAGES.hi.nav.groups.Catalog);
    const products = catalog.items.find((i) => i.href === "/dashboard/products")!;
    expect(products.label).toBe(MESSAGES.hi.nav.items["/dashboard/products"]);
    expect(products.alt).toBe("Products");
  });

  it("t() fills placeholders and falls back to the key", () => {
    const t = createT("hi");
    expect(t("pages.orders.detailTitle", { number: "#1042" })).toContain("#1042");
    expect(createT("en")("banners.daysLeft", { days: 3 })).toBe("3 days left");
    expect(format("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
