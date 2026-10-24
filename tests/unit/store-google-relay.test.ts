import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/public", () => ({ publicEnv: () => ({ NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocartdev.in" }) }));
vi.mock("@/lib/platform/hosts", () => ({ platformHostAliases: () => [] }));
vi.mock("@/lib/tenant/directory", () => ({
  tenantDirectory: { findByHost: async (host: string) => (host === "fashion-billa.pictocartdev.in" ? { tenantId: "t1" } : null) },
}));

/** Store Google sign-in relayed through the platform host (features/customer-account/server/google-relay.ts). */
describe("store Google sign-in relay", () => {
  it("only returns to stores we serve", async () => {
    const { verifiedStoreHost } = await import("@/features/customer-account/server/google-relay");
    expect(await verifiedStoreHost("fashion-billa.pictocartdev.in")).toBe("fashion-billa.pictocartdev.in");
    expect(await verifiedStoreHost("evil.example.com")).toBeNull();
    expect(await verifiedStoreHost("pictocartdev.in")).toBeNull();
    expect(await verifiedStoreHost("unknown-store.pictocartdev.in")).toBeNull();
    expect(await verifiedStoreHost("bad host/../x")).toBeNull();
    expect(await verifiedStoreHost(null)).toBeNull();
  });

  it("lands on the customer profile by default and builds the hand-off links", async () => {
    const { relayCallbackUrl, relayNext, storeHandoffUrl } = await import("@/features/customer-account/server/google-relay");
    expect(relayNext(null)).toBe("/account");
    expect(relayNext("https://evil.example.com")).toBe("/account");
    expect(relayNext("/account/orders")).toBe("/account/orders");
    expect(relayCallbackUrl("https://pictocartdev.in", "fashion-billa.pictocartdev.in", "/account")).toBe(
      "https://pictocartdev.in/auth/store-google/callback?host=fashion-billa.pictocartdev.in&next=%2Faccount",
    );
    expect(storeHandoffUrl("https://fashion-billa.pictocartdev.in", "abc123", "/account")).toBe(
      "https://fashion-billa.pictocartdev.in/account/auth/callback?token_hash=abc123&type=email&next=%2Faccount",
    );
  });
});
