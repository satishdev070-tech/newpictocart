import { describe, expect, it } from "vitest";
import { rankStoreHosts } from "@/features/integrations/server/store";

describe("rankStoreHosts", () => {
  it("drops localhost seeds in production and puts the custom domain first", () => {
    const rows = [
      { hostname: "the-paliya.localhost", is_primary: true, type: "platform_subdomain" },
      { hostname: "the-paliya.pictocart.in", is_primary: false, type: "platform_subdomain" },
      { hostname: "thepaliya.com", is_primary: false, type: "custom" },
    ];
    expect(rankStoreHosts(rows, "pictocart.in")).toEqual(["thepaliya.com", "the-paliya.pictocart.in"]);
  });

  it("keeps localhost hosts when the platform runs on localhost", () => {
    expect(rankStoreHosts([{ hostname: "acme.localhost", is_primary: true, type: "platform_subdomain" }], "localhost")).toEqual(["acme.localhost"]);
  });

  it("prefers the current root over an old one", () => {
    const rows = [
      { hostname: "acme.pictocart.in", is_primary: false, type: "platform_subdomain" },
      { hostname: "acme.pictocart.in", is_primary: false, type: "platform_subdomain" },
    ];
    expect(rankStoreHosts(rows, "pictocart.in")[0]).toBe("acme.pictocart.in");
  });
});
