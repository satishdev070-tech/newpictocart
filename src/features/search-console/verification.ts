import { normalizeHost } from "@/lib/tenant/host";

/**
 * Google Search Console ownership verification for the platform's own sites. Pure (no
 * `server-only`, no I/O) so the proxy, the public route, server actions and tests share it.
 *
 * Two independent "domains" are managed: Production and Staging. Each has a FIXED host
 * allowlist (apex + www). Store subdomains (`acme.pictocart.in`) and custom domains are never on
 * it, so a verification file can't be served from a merchant's storefront.
 */

export const GSC_DOMAINS = ["production", "staging"] as const;
export type GscDomain = (typeof GSC_DOMAINS)[number];

export const GSC_DOMAIN_INFO: Readonly<Record<GscDomain, { label: string; apex: string; hosts: readonly string[]; primaryHost: string }>> = {
  production: { label: "Production", apex: "pictocart.in", hosts: ["pictocart.in", "www.pictocart.in"], primaryHost: "www.pictocart.in" },
  staging: { label: "Staging", apex: "pictocartdev.in", hosts: ["pictocartdev.in", "www.pictocartdev.in"], primaryHost: "www.pictocartdev.in" },
};

export const GSC_FILENAME_RE = /^google[0-9a-f]{16}\.html$/;
/** Path form, as requested by Google: `/googleXXXXXXXXXXXXXXXX.html`. */
export const GSC_PATH_RE = /^\/google[0-9a-f]{16}\.html$/;
export const GSC_MAX_FILE_BYTES = 10 * 1024;
export const GSC_CONTENT_TYPE = "text/html; charset=utf-8";
/** Internal route the proxy rewrites verification paths into (see src/proxy.ts). */
export const GSC_ROUTE_PREFIX = "/api/site-verification/google";

export const SEARCH_CONSOLE_URL = "https://search.google.com/search-console";
export const CLOUDFLARE_DNS_URL = "https://dash.cloudflare.com/?to=/:account/:zone/dns/records";

export function isGscDomain(value: unknown): value is GscDomain {
  return typeof value === "string" && (GSC_DOMAINS as readonly string[]).includes(value);
}

/** Which managed domain (if any) serves `host`. Exact allowlist match; never a suffix match. */
export function gscDomainForHost(host: string | null | undefined): GscDomain | null {
  const h = normalizeHost(host);
  if (!h) return null;
  for (const d of GSC_DOMAINS) if (GSC_DOMAIN_INFO[d].hosts.includes(h)) return d;
  return null;
}

/** `/googleXXXXXXXXXXXXXXXX.html` → filename, else null. Rejects traversal, case changes, extra segments. */
export function gscFilenameFromPath(pathname: string): string | null {
  return GSC_PATH_RE.test(pathname) ? pathname.slice(1) : null;
}

export function gscPublicUrl(domain: GscDomain, filename: string): string {
  return `https://${GSC_DOMAIN_INFO[domain].primaryHost}/${filename}`;
}

/** The exact body Google expects for a given verification filename. */
export function expectedGscContent(filename: string): string {
  return `google-site-verification: ${filename}`;
}

export type GscFileValidation = { ok: true; filename: string; content: string } | { ok: false; message: string };

/**
 * Strict validation of an uploaded verification file. Only Google's one-line file is accepted:
 * the name must be `google<16 hex>.html`, at most 10 KB, and the content exactly
 * `google-site-verification: <filename>` with an optional single trailing newline.
 * Anything else (arbitrary HTML, scripts, a different token, traversal names) is rejected.
 */
export function validateGscFile(input: { name: string; size: number; text: string }): GscFileValidation {
  const name = input.name;
  if (!GSC_FILENAME_RE.test(name)) {
    return { ok: false, message: "File name must look like google0123456789abcdef.html (the file Google gave you, not renamed)." };
  }
  if (input.size > GSC_MAX_FILE_BYTES || input.text.length > GSC_MAX_FILE_BYTES) {
    return { ok: false, message: "File is too large. Google's verification file is a single line (max 10 KB)." };
  }
  const expected = expectedGscContent(name);
  let text = input.text;
  // Tolerate a UTF-8 BOM and one trailing newline (LF or CRLF), nothing else.
  if (text.startsWith("﻿")) text = text.slice(1);
  const trailing = text.endsWith("\r\n") ? "\r\n" : text.endsWith("\n") ? "\n" : "";
  const body = trailing ? text.slice(0, -trailing.length) : text;
  if (body !== expected) {
    return { ok: false, message: `File content must be exactly "${expected}". Download a fresh copy from Search Console and upload it unchanged.` };
  }
  // Store the canonical form (LF only) so delivery is byte-for-byte predictable.
  return { ok: true, filename: name, content: trailing ? `${expected}\n` : expected };
}

const DNS_TOKEN_RE = /^[A-Za-z0-9_-]{10,100}$/;
const DNS_PREFIX = "google-site-verification=";

/** Accepts `google-site-verification=TOKEN`, a quoted copy, or the bare token. Returns the full record value. */
export function normalizeGscDnsValue(raw: string): string | null {
  let v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).trim();
  const token = v.toLowerCase().startsWith(DNS_PREFIX) ? v.slice(DNS_PREFIX.length) : v;
  return DNS_TOKEN_RE.test(token) ? `${DNS_PREFIX}${token}` : null;
}

export type GscDnsStatus = "found" | "not_found" | "failed";

export type GscDeliveryResult = { ok: true } | { ok: false; reason: string };

/** Judges a live fetch of the public URL: 200, text/html, body exactly the stored content. */
export function evaluateGscDelivery(res: { status: number; contentType: string | null; body: string }, expected: string): GscDeliveryResult {
  if (res.status >= 300 && res.status < 400) return { ok: false, reason: `The URL redirects (HTTP ${res.status}). Google needs HTTP 200 with the file itself.` };
  if (res.status !== 200) return { ok: false, reason: `The URL returned HTTP ${res.status} instead of 200.` };
  if (!(res.contentType ?? "").toLowerCase().startsWith("text/html")) return { ok: false, reason: `Wrong Content-Type (${res.contentType ?? "none"}); expected text/html.` };
  if (res.body !== expected) return { ok: false, reason: "The URL returned different content than the uploaded file." };
  return { ok: true };
}

export type GscFileStatus = "not_configured" | "uploaded" | "accessible" | "failed";

export function gscFileStatus(row: { active: boolean; filename: string | null; last_delivery_status: string | null } | null | undefined): GscFileStatus {
  if (!row || !row.active || !row.filename) return "not_configured";
  if (row.last_delivery_status === "ok") return "accessible";
  if (row.last_delivery_status === "failed") return "failed";
  return "uploaded";
}
