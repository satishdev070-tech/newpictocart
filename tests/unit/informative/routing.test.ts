import { describe, expect, it } from "vitest";
import { decideRoute } from "@/lib/tenant/routing";

const ROOT = "pictocart.in";

describe("/informative panel route registration", () => {
  it("is served on the platform host", () => {
    expect(decideRoute("pictocart.in", "/informative/dashboard", ROOT).action).toBe("next");
    expect(decideRoute("www.pictocart.in", "/informative", ROOT).action).toBe("next");
  });

  it("404s on store hosts and custom domains, like /dashboard", () => {
    expect(decideRoute("acme.pictocart.in", "/informative", ROOT).action).toBe("not-found");
    expect(decideRoute("acme.pictocart.in", "/informative/dashboard", ROOT).action).toBe("not-found");
    expect(decideRoute("www.brand.in", "/informative/services", ROOT).action).toBe("not-found");
  });

  it("leaves similarly named store paths alone", () => {
    expect(decideRoute("acme.pictocart.in", "/informatives", ROOT).action).toBe("rewrite");
    expect(decideRoute("acme.pictocart.in", "/pages/informative", ROOT).action).toBe("rewrite");
  });
});
