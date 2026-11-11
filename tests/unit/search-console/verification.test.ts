import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  GSC_PATH_RE,
  evaluateGscDelivery,
  expectedGscContent,
  gscDomainForHost,
  gscFilenameFromPath,
  gscFileStatus,
  gscPublicUrl,
  normalizeGscDnsValue,
  validateGscFile,
} from "@/features/search-console/verification";
import { evaluateGscDns, runGscDeliveryCheck, runGscDnsCheck } from "@/features/search-console/checks";

const FIXTURE_NAME = "googlea53e7e51ec71d7b4.html";
const FIXTURE = readFileSync(new URL(`./fixtures/${FIXTURE_NAME}`, import.meta.url), "utf8");
const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20261111007200_search_console_verification.sql", import.meta.url), "utf8");

const file = (name: string, text: string, size = new TextEncoder().encode(text).length) => validateGscFile({ name, size, text });

describe("validateGscFile", () => {
  it("accepts the real Search Console file unchanged", () => {
    expect(FIXTURE).toBe(`google-site-verification: ${FIXTURE_NAME}`);
    expect(file(FIXTURE_NAME, FIXTURE)).toEqual({ ok: true, filename: FIXTURE_NAME, content: FIXTURE });
  });

  it("allows one trailing newline (LF or CRLF) and a BOM, storing LF", () => {
    expect(file(FIXTURE_NAME, `${FIXTURE}\n`)).toMatchObject({ ok: true, content: `${FIXTURE}\n` });
    expect(file(FIXTURE_NAME, `${FIXTURE}\r\n`)).toMatchObject({ ok: true, content: `${FIXTURE}\n` });
    expect(file(FIXTURE_NAME, `﻿${FIXTURE}`)).toMatchObject({ ok: true, content: FIXTURE });
    expect(file(FIXTURE_NAME, `${FIXTURE}\n\n`).ok).toBe(false);
  });

  it("rejects names that aren't google<16 hex>.html, including traversal", () => {
    for (const name of ["../googlea53e7e51ec71d7b4.html", "googlea53e7e51ec71d7b4.htm", "GOOGLEA53E7E51EC71D7B4.html", "googlea53e7e51ec71d7b.html", "googlea53e7e51ec71d7b4 (2).html", "googlezzzzzzzzzzzzzzzz.html", "index.html", "googlea53e7e51ec71d7b4.html/x"]) {
      expect(file(name, expectedGscContent(name)).ok, name).toBe(false);
    }
  });

  it("rejects oversized files", () => {
    expect(file(FIXTURE_NAME, FIXTURE, 10 * 1024 + 1)).toMatchObject({ ok: false, message: expect.stringContaining("too large") });
    expect(file(FIXTURE_NAME, FIXTURE + " ".repeat(11_000)).ok).toBe(false);
  });

  it("rejects content that doesn't match the filename, HTML and scripts", () => {
    expect(file(FIXTURE_NAME, "google-site-verification: google0000000000000000.html").ok).toBe(false);
    expect(file(FIXTURE_NAME, `<html><body>${FIXTURE}</body></html>`).ok).toBe(false);
    expect(file(FIXTURE_NAME, `${FIXTURE}<script>alert(1)</script>`).ok).toBe(false);
    expect(file(FIXTURE_NAME, ` ${FIXTURE}`).ok).toBe(false);
    expect(file(FIXTURE_NAME, "").ok).toBe(false);
  });
});

describe("hosts and paths", () => {
  it("maps only the fixed apex/www hosts to each domain", () => {
    expect(gscDomainForHost("pictocart.in")).toBe("production");
    expect(gscDomainForHost("WWW.PICTOCART.IN:443")).toBe("production");
    expect(gscDomainForHost("pictocartdev.in")).toBe("staging");
    expect(gscDomainForHost("www.pictocartdev.in")).toBe("staging");
    for (const h of ["acme.pictocart.in", "admin.pictocart.in", "evilpictocart.in", "pictocart.in.evil.com", "localhost", null, ""]) expect(gscDomainForHost(h), String(h)).toBeNull();
  });

  it("extracts only an exact /googleXXXXXXXXXXXXXXXX.html path", () => {
    expect(gscFilenameFromPath(`/${FIXTURE_NAME}`)).toBe(FIXTURE_NAME);
    for (const p of [`/x/${FIXTURE_NAME}`, `/${FIXTURE_NAME}/`, `/%2e%2e/${FIXTURE_NAME}`, "/GOOGLEA53E7E51EC71D7B4.html", "/google.html"]) expect(gscFilenameFromPath(p), p).toBeNull();
    expect(GSC_PATH_RE.test(`/${FIXTURE_NAME}`)).toBe(true);
  });

  it("public URL uses the primary (www) host per domain", () => {
    expect(gscPublicUrl("production", FIXTURE_NAME)).toBe(`https://www.pictocart.in/${FIXTURE_NAME}`);
    expect(gscPublicUrl("staging", FIXTURE_NAME)).toBe(`https://www.pictocartdev.in/${FIXTURE_NAME}`);
  });
});

describe("status", () => {
  it("derives Not configured / Uploaded / Publicly accessible / Delivery failed", () => {
    expect(gscFileStatus(null)).toBe("not_configured");
    expect(gscFileStatus({ active: false, filename: FIXTURE_NAME, last_delivery_status: "ok" })).toBe("not_configured");
    expect(gscFileStatus({ active: true, filename: FIXTURE_NAME, last_delivery_status: null })).toBe("uploaded");
    expect(gscFileStatus({ active: true, filename: FIXTURE_NAME, last_delivery_status: "ok" })).toBe("accessible");
    expect(gscFileStatus({ active: true, filename: FIXTURE_NAME, last_delivery_status: "failed" })).toBe("failed");
  });
});

describe("delivery check", () => {
  it("passes only for 200 + text/html + exact body", () => {
    expect(evaluateGscDelivery({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }, FIXTURE)).toEqual({ ok: true });
    expect(evaluateGscDelivery({ status: 301, contentType: null, body: "" }, FIXTURE).ok).toBe(false);
    expect(evaluateGscDelivery({ status: 404, contentType: "text/html", body: FIXTURE }, FIXTURE).ok).toBe(false);
    expect(evaluateGscDelivery({ status: 200, contentType: "text/plain", body: FIXTURE }, FIXTURE).ok).toBe(false);
    expect(evaluateGscDelivery({ status: 200, contentType: "text/html", body: `<html>${FIXTURE}</html>` }, FIXTURE).ok).toBe(false);
  });

  it("fetches without following redirects and reports network errors as failed", async () => {
    const ok = vi.fn(async () => new Response(FIXTURE, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
    expect(await runGscDeliveryCheck(`https://www.pictocart.in/${FIXTURE_NAME}`, FIXTURE, { fetchImpl: ok as unknown as typeof fetch })).toEqual({ ok: true });
    expect((ok.mock.calls[0] as unknown as [string, RequestInit])[1]).toMatchObject({ redirect: "manual", cache: "no-store" });
    const boom = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect((await runGscDeliveryCheck("https://www.pictocart.in/x", FIXTURE, { fetchImpl: boom as unknown as typeof fetch })).ok).toBe(false);
  });
});

describe("DNS TXT", () => {
  const VALUE = "google-site-verification=ZTHsfVTDELaOSswov8ZoSfuNLjSzTJKRjAF_abc-123";

  it("normalises pasted values", () => {
    expect(normalizeGscDnsValue(VALUE)).toBe(VALUE);
    expect(normalizeGscDnsValue(`  "${VALUE}" `)).toBe(VALUE);
    expect(normalizeGscDnsValue("ZTHsfVTDELaOSswov8ZoSfuNLjSzTJKRjAF_abc-123")).toBe(VALUE);
    for (const bad of ["", "google-site-verification=", "google-site-verification=a b", "v=spf1 include:x", "<script>"]) expect(normalizeGscDnsValue(bad), bad).toBeNull();
  });

  const doh = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/dns-json" } })) as unknown as typeof fetch;

  it("Found when the apex TXT includes the value", async () => {
    const fetchImpl = doh({ Status: 0, Answer: [{ name: "pictocart.in.", type: 16, data: '"v=spf1 -all"' }, { name: "pictocart.in.", type: 16, data: `"${VALUE}"` }] });
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl })).toBe("found");
  });

  it("Not found when the record is absent, different, or the name doesn't exist", async () => {
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: doh({ Status: 0, Answer: [{ name: "pictocart.in.", type: 16, data: '"google-site-verification=other"' }] }) })).toBe("not_found");
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: doh({ Status: 0 }) })).toBe("not_found");
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: doh({ Status: 3 }) })).toBe("not_found");
    // A TXT on another name (e.g. a subdomain) does not count.
    expect(evaluateGscDns("pictocart.in", VALUE, { Status: 0, Answer: [{ name: "www.pictocart.in.", type: 16, data: `"${VALUE}"` }] })).toBe("not_found");
  });

  it("Lookup failed on SERVFAIL, HTTP errors and network errors", async () => {
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: doh({ Status: 2 }) })).toBe("failed");
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: doh({}, 502) })).toBe("failed");
    const boom = vi.fn(async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await runGscDnsCheck("pictocart.in", VALUE, { fetchImpl: boom })).toBe("failed");
  });
});

describe("migration", () => {
  it("locks the table with RLS for super admins and exposes only the active-file lookup to anon", () => {
    expect(MIGRATION).toContain("enable row level security");
    expect(MIGRATION).toContain("app.has_platform_permission('platform.settings.manage')");
    expect(MIGRATION).toMatch(/revoke all on public\.platform_search_console_verifications from anon, authenticated;/);
    expect(MIGRATION).not.toMatch(/grant [a-z, ]+ on public\.platform_search_console_verifications to anon/);
    expect(MIGRATION).toContain("grant execute on function public.gsc_verification_file(text, text) to anon");
    expect(MIGRATION).toContain("and v.active");
    expect(MIGRATION).toContain("'^google[0-9a-f]{16}\\.html$'");
  });
});
