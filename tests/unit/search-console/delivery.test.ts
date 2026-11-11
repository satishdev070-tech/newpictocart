import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const store = vi.hoisted(() => ({ findGscFileContent: vi.fn() }));
vi.mock("@/features/search-console/server/store", () => store);

import { GET } from "@/app/api/site-verification/google/[file]/route";

const NAME = "googlea53e7e51ec71d7b4.html";
const CONTENT = readFileSync(new URL(`./fixtures/${NAME}`, import.meta.url), "utf8");

/** Calls the public handler as the proxy would (verified host in x-paliya-host). */
function get(host: string | null, file = NAME) {
  const headers = new Headers();
  if (host) headers.set("x-paliya-host", host);
  return GET(new Request(`https://internal/api/site-verification/google/${file}`, { headers }), { params: Promise.resolve({ file }) });
}

beforeEach(() => {
  store.findGscFileContent.mockReset();
  // Production has the real file; staging has a different one.
  store.findGscFileContent.mockImplementation(async (domain: string, file: string) => {
    if (domain === "production" && file === NAME) return CONTENT;
    if (domain === "staging" && file === "google0123456789abcdef.html") return "google-site-verification: google0123456789abcdef.html";
    return null;
  });
});

describe("public delivery handler", () => {
  it("serves the exact stored body as text/html on production hosts", async () => {
    for (const host of ["www.pictocart.in", "pictocart.in"]) {
      const res = await get(host);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await res.text()).toBe(CONTENT);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
    }
    expect(store.findGscFileContent).toHaveBeenCalledWith("production", NAME);
  });

  it("isolates production and staging", async () => {
    expect((await get("www.pictocartdev.in")).status).toBe(404);
    expect(store.findGscFileContent).toHaveBeenLastCalledWith("staging", NAME);
    const staging = await get("pictocartdev.in", "google0123456789abcdef.html");
    expect(staging.status).toBe(200);
    expect((await get("www.pictocart.in", "google0123456789abcdef.html")).status).toBe(404);
  });

  it("never serves on store subdomains, custom domains or without a verified host", async () => {
    for (const host of ["acme.pictocart.in", "shop.example.com", "acme.pictocartdev.in", null]) {
      const res = await get(host);
      expect(res.status, String(host)).toBe(404);
    }
    expect(store.findGscFileContent).not.toHaveBeenCalled();
  });

  it("404s for bad filenames without touching the database", async () => {
    for (const f of ["index.html", "..%2fgooglea53e7e51ec71d7b4.html", "GOOGLEA53E7E51EC71D7B4.html"]) expect((await get("www.pictocart.in", f)).status).toBe(404);
    expect(store.findGscFileContent).not.toHaveBeenCalled();
  });
});

describe("proxy bypass", () => {
  const ENV = { NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in", NEXT_PUBLIC_PLATFORM_URL: "https://www.pictocart.in", PLATFORM_HOST_ALIASES: "pictocartdev.in,www.pictocartdev.in" };

  async function route(host: string, path: string, headers: Record<string, string> = {}) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxxxxxx");
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } }));
    const rewrite = res.headers.get("x-middleware-rewrite");
    return { res, to: rewrite ? new URL(rewrite).pathname : "next" };
  }
  afterEach(() => vi.unstubAllEnvs());

  it("rewrites the verification path on allowlisted hosts before tenant routing", async () => {
    for (const host of ["www.pictocart.in", "pictocart.in", "pictocartdev.in", "www.pictocartdev.in"]) {
      expect((await route(host, `/${NAME}?x=1`)).to, host).toBe(`/api/site-verification/google/${NAME}`);
    }
  });

  it("forwards the proxy-verified host, overriding a client-supplied one", async () => {
    const { res } = await route("www.pictocart.in", `/${NAME}`, { "x-paliya-host": "acme.pictocart.in" });
    expect(res.headers.get("x-middleware-request-x-paliya-host")).toBe("www.pictocart.in");
  });

  it("does not refresh or set auth cookies for verification files", async () => {
    const { res } = await route("www.pictocart.in", `/${NAME}`, { cookie: "sb-abc-auth-token=garbage" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("leaves store subdomains and other paths on their normal routes", async () => {
    expect((await route("acme.pictocart.in", `/${NAME}`)).to).toBe(`/store/acme.pictocart.in/${NAME}`);
    expect((await route("www.pictocart.in", "/googlea53e7e51ec71d7b4.htm")).to).toBe("next");
    expect((await route("www.pictocart.in", `/x/${NAME}`)).to).toBe("next");
  });
});
