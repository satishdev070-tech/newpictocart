import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const googleSignInAvailable = vi.fn();
const googleIdentityClientId = vi.fn();

vi.mock("@/features/auth/google", () => ({
  googleSignInAvailable: (...args: unknown[]) => googleSignInAvailable(...args),
  googleIdentityClientId: (...args: unknown[]) => googleIdentityClientId(...args),
}));

beforeEach(() => {
  vi.resetModules();
  googleSignInAvailable.mockReset();
  googleIdentityClientId.mockReset();
});

describe("resolveGoogleSignInMode", () => {
  it("returns redirect when Google is on and GIS has no client id", async () => {
    googleSignInAvailable.mockResolvedValue(true);
    googleIdentityClientId.mockResolvedValue(null);
    const { resolveGoogleSignInMode } = await import("@/components/auth/google-sign-in-slot");
    expect(await resolveGoogleSignInMode()).toEqual({ kind: "redirect" });
  });

  it("returns gis when a client id is available", async () => {
    googleSignInAvailable.mockResolvedValue(true);
    googleIdentityClientId.mockResolvedValue("1234567890-abcdefg.apps.googleusercontent.com");
    const { resolveGoogleSignInMode } = await import("@/components/auth/google-sign-in-slot");
    expect(await resolveGoogleSignInMode()).toEqual({
      kind: "gis",
      clientId: "1234567890-abcdefg.apps.googleusercontent.com",
    });
  });

  it("returns none when settings throws so Login still paints", async () => {
    googleSignInAvailable.mockRejectedValue(new Error("settings down"));
    const { resolveGoogleSignInMode } = await import("@/components/auth/google-sign-in-slot");
    expect(await resolveGoogleSignInMode()).toEqual({ kind: "none" });
  });

  it("rethrows Next dynamic-server bailouts", async () => {
    const bailout = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
    googleSignInAvailable.mockRejectedValue(bailout);
    const { resolveGoogleSignInMode } = await import("@/components/auth/google-sign-in-slot");
    await expect(resolveGoogleSignInMode()).rejects.toBe(bailout);
  });
});

describe("MerchantAside import surface", () => {
  it("does not import the marketplace catalogue into the auth shell", async () => {
    const src = await readFile(path.join(process.cwd(), "src/components/auth/auth-asides.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']@\/features\/theme\/marketplace\//);
  });
});
