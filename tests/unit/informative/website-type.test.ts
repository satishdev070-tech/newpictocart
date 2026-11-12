import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEBSITE_TYPE,
  INFORMATIVE_HOME,
  WEBSITE_TYPE,
  WEBSITE_TYPES,
  allInformative,
  isInformativePanelPath,
  isInformativeWebsite,
  isWebsiteType,
  parseWebsiteType,
} from "@/features/informative/website-type";

describe("website type constant", () => {
  it("has exactly the two plan values and defaults to ONLINE_STORE", () => {
    expect(WEBSITE_TYPES).toEqual(["ONLINE_STORE", "INFORMATIVE"]);
    expect(DEFAULT_WEBSITE_TYPE).toBe(WEBSITE_TYPE.ONLINE_STORE);
  });

  it("reads anything missing, unknown or malformed as ONLINE_STORE", () => {
    for (const v of [undefined, null, "", "informative", "online_store", "SHOP", 1, {}, []]) {
      expect(parseWebsiteType(v)).toBe("ONLINE_STORE");
    }
    expect(parseWebsiteType("INFORMATIVE")).toBe("INFORMATIVE");
    expect(parseWebsiteType("ONLINE_STORE")).toBe("ONLINE_STORE");
    expect(isWebsiteType("INFORMATIVE")).toBe(true);
    expect(isWebsiteType("informative")).toBe(false);
  });

  it("isInformativeWebsite is true only for INFORMATIVE", () => {
    expect(isInformativeWebsite("INFORMATIVE")).toBe(true);
    expect(isInformativeWebsite("ONLINE_STORE")).toBe(false);
    expect(isInformativeWebsite(undefined)).toBe(false);
    expect(isInformativeWebsite(null)).toBe(false);
  });

  it("matches only the /informative panel paths", () => {
    expect(INFORMATIVE_HOME).toBe("/informative/dashboard");
    for (const p of ["/informative", "/informative/", "/informative/dashboard", "/informative?x=1"]) expect(isInformativePanelPath(p)).toBe(true);
    for (const p of ["/informatives", "/dashboard", "/", "/start/informative"]) expect(isInformativePanelPath(p)).toBe(false);
  });

  it("allInformative needs at least one store and every store INFORMATIVE", () => {
    expect(allInformative([])).toBe(false);
    expect(allInformative(["INFORMATIVE"])).toBe(true);
    expect(allInformative(["INFORMATIVE", "INFORMATIVE"])).toBe(true);
    expect(allInformative(["INFORMATIVE", "ONLINE_STORE"])).toBe(false);
    expect(allInformative(["INFORMATIVE", null])).toBe(false);
  });
});
