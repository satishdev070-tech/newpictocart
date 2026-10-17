import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { FetchGuardError, assertSafeUrl, guardedLookup, isBlockedAddress, readLimited, safeFetchText, type Resolver } from "@/features/theme/builder/fetch-guard";

const resolveTo =
  (...ips: string[]): Resolver =>
  (_host, cb) =>
    cb(
      null,
      ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
    );

const reason = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (e) {
    return e instanceof FetchGuardError ? e.reason : `other: ${(e as Error).message}`;
  }
  return "no error";
};

describe("theme builder URL fetch guard", () => {
  it("blocks loopback, private, link-local, CGNAT, metadata and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "fc00::abcd", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "[::1]", "not-an-ip"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::6810:85e5", "::ffff:8.8.8.8"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("accepts only public https URLs on the default port without credentials", async () => {
    expect(assertSafeUrl("https://example.com/shop?x=1").hostname).toBe("example.com");
    expect(assertSafeUrl("https://shop.example.co.in:443/").hostname).toBe("shop.example.co.in");
    expect(await reason(() => assertSafeUrl("http://example.com"))).toBe("invalid_url");
    expect(await reason(() => assertSafeUrl("ftp://example.com"))).toBe("invalid_url");
    expect(await reason(() => assertSafeUrl("javascript:alert(1)"))).toBe("invalid_url");
    expect(await reason(() => assertSafeUrl("not a url"))).toBe("invalid_url");
    expect(await reason(() => assertSafeUrl("https://user:pw@example.com"))).toBe("invalid_url");
    expect(await reason(() => assertSafeUrl("https://example.com:8443/"))).toBe("blocked_host");
    for (const u of ["https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://10.0.0.5/", "https://169.254.169.254/latest/meta-data", "https://intranet/", "https://printer.local/", "https://app.localhost/", "https://router.lan/"]) {
      expect(await reason(() => assertSafeUrl(u)), u).toBe("blocked_host");
    }
  });

  it("refuses to connect when a public-looking name resolves to a private address (checked at connect time)", async () => {
    const lookup = guardedLookup(resolveTo("93.184.216.34", "10.0.0.7"));
    const err = await new Promise<NodeJS.ErrnoException | null>((res) => (lookup as unknown as (h: string, o: object, cb: (e: NodeJS.ErrnoException | null) => void) => void)("evil.example.com", { all: true }, (e) => res(e)));
    expect(err).toBeInstanceOf(FetchGuardError);
    expect((err as FetchGuardError).reason).toBe("blocked_address");

    const ok = await new Promise<unknown>((res) => (lookup as unknown as (h: string, o: object, cb: (e: unknown, a: unknown) => void) => void)("x", {}, () => res("called")));
    expect(ok).toBe("called");
    expect(await reason(safeFetchText("https://rebind.example.com/", { resolver: resolveTo("127.0.0.1"), timeoutMs: 2000 }))).toBe("blocked_address");
    expect(await reason(safeFetchText("https://metadata.example.com/", { resolver: resolveTo("169.254.169.254"), timeoutMs: 2000 }))).toBe("blocked_address");
  });

  it("caps the body size", async () => {
    const small = await readLimited(Readable.from([Buffer.from("abc"), Buffer.from("def")]), 10);
    expect(small.toString()).toBe("abcdef");
    const big = Readable.from((function* () {
      for (let i = 0; i < 100; i++) yield Buffer.alloc(1024, 97);
    })());
    expect(await reason(readLimited(big, 10_000))).toBe("too_large");
  });

  it("times out instead of hanging", async () => {
    const slow: Resolver = () => undefined; // never resolves
    expect(await reason(safeFetchText("https://slow.example.com/", { resolver: slow, timeoutMs: 50 }))).toBe("timeout");
  });
});
