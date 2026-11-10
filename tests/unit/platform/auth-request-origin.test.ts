import { describe, expect, it } from "vitest";
import { authRequestOrigin } from "@/lib/platform/urls";

const base = {
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocartdev.in",
  NEXT_PUBLIC_PLATFORM_URL: "https://www.pictocartdev.in",
  PLATFORM_HOST_ALIASES: "pictocart.in,www.pictocart.in",
};

describe("authRequestOrigin", () => {
  it("uses the browser host when it is the platform root or www", () => {
    expect(authRequestOrigin("www.pictocartdev.in", base)).toBe("https://www.pictocartdev.in");
    expect(authRequestOrigin("pictocartdev.in", base)).toBe("https://pictocartdev.in");
  });

  it("uses PLATFORM_HOST_ALIASES so PKCE stays on the alias host", () => {
    expect(authRequestOrigin("www.pictocart.in", base)).toBe("https://www.pictocart.in");
    expect(authRequestOrigin("pictocart.in", base)).toBe("https://pictocart.in");
  });

  it("falls back to NEXT_PUBLIC_PLATFORM_URL for unknown / store hosts", () => {
    expect(authRequestOrigin("aangan.pictocartdev.in", base)).toBe("https://www.pictocartdev.in");
    expect(authRequestOrigin("evil.example.com", base)).toBe("https://www.pictocartdev.in");
    expect(authRequestOrigin(null, base)).toBe("https://www.pictocartdev.in");
  });

  it("preserves localhost port from PLATFORM_URL", () => {
    const local = {
      NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "localhost",
      NEXT_PUBLIC_PLATFORM_URL: "http://localhost:3001",
      PLATFORM_HOST_ALIASES: "",
    };
    expect(authRequestOrigin("localhost:3001", local)).toBe("http://localhost:3001");
  });
});
