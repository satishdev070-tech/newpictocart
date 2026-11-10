/**
 * Draft-theme preview tokens (pure half). The dashboard (seller with theme.edit) mints a
 * short-lived token bound to ONE tenant; the storefront's /preview route verifies it and
 * stores it in an httpOnly cookie; the storefront layout re-verifies it on every request
 * before rendering the DRAFT instead of the published theme. Signing lives in
 * ./server/preview.ts (needs APP_SECRET).
 */

export const PREVIEW_PURPOSE = "theme-preview";
export const PREVIEW_COOKIE = "sf_preview";
export const PREVIEW_TTL_SECONDS = 2 * 60 * 60;

export type PreviewClaims = { tenantId: string; userId: string; expiresAt: number };

/**
 * Why a preview token was rejected after the host resolved.
 * `bad_token` remains the coarse umbrella used before finer codes existed.
 */
export type PreviewTokenFailReason =
  | "sig_fail"
  | "malformed"
  | "bad_uuid"
  | "tenant_mismatch"
  | "expired"
  | "not_yet_valid"
  | "bad_token";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodePreviewClaims(c: PreviewClaims): string {
  return JSON.stringify({ t: c.tenantId, u: c.userId, x: c.expiresAt });
}

/**
 * Parses a VERIFIED token payload and checks it is for `tenantId` and not expired.
 * Prefer {@link explainPreviewClaims} when the caller needs a failure reason.
 */
export function decodePreviewClaims(payload: string, tenantId: string, nowMs = Date.now()): PreviewClaims | null {
  const r = explainPreviewClaims(payload, tenantId, nowMs);
  return r.ok ? r.claims : null;
}

/** Same checks as {@link decodePreviewClaims}, with a precise failure reason. */
export function explainPreviewClaims(
  payload: string,
  tenantId: string,
  nowMs = Date.now(),
): { ok: true; claims: PreviewClaims } | { ok: false; reason: Exclude<PreviewTokenFailReason, "sig_fail" | "bad_token"> } {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "malformed" };
  const { t, u, x } = raw as Record<string, unknown>;
  if (typeof t !== "string" || typeof u !== "string" || typeof x !== "number" || !Number.isInteger(x)) {
    return { ok: false, reason: "malformed" };
  }
  if (!UUID_RE.test(t) || !UUID_RE.test(u)) return { ok: false, reason: "bad_uuid" };
  if (t.toLowerCase() !== tenantId.toLowerCase()) return { ok: false, reason: "tenant_mismatch" };
  const now = Math.floor(nowMs / 1000);
  if (x <= now) return { ok: false, reason: "expired" };
  if (x > now + PREVIEW_TTL_SECONDS + 60) return { ok: false, reason: "not_yet_valid" };
  return { ok: true, claims: { tenantId: t, userId: u, expiresAt: x } };
}

/**
 * Rough cookie-site key (last two labels). `pictocartdev.in` ≠ `pictocart.in`.
 * localhost / *.localhost stay as the full host.
 */
export function cookieSiteKey(host: string): string {
  const h = host.toLowerCase().split(":")[0]!;
  if (h === "localhost" || h.endsWith(".localhost")) return h;
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

export function hostsAreSameCookieSite(a: string, b: string): boolean {
  return cookieSiteKey(a) === cookieSiteKey(b);
}

/**
 * Platform subdomains are same-site to `www.{root}` → Lax is fine in the editor iframe.
 * Dashboard aliases on another eTLD+1 (e.g. pictocartdev.in → *.pictocart.in) are cross-site →
 * need SameSite=None; Partitioned. Custom domains are always cross-site.
 */
export function previewCookieNeedsPartitioned(
  storeHost: string,
  parentOrigin: string | null | undefined,
  platformSubdomain: boolean,
): boolean {
  if (!platformSubdomain) return true;
  if (!parentOrigin) return false;
  try {
    return !hostsAreSameCookieSite(storeHost, new URL(parentOrigin).host);
  } catch {
    return false;
  }
}

/** Storefront URL that installs the preview cookie and lands on `path`. */
export function previewEntryUrl(
  storeOrigin: string,
  token: string,
  path = "/",
  parentOrigin?: string | null,
): string {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const url = new URL("/preview", storeOrigin.endsWith("/") ? storeOrigin : `${storeOrigin}/`);
  url.searchParams.set("token", token);
  url.searchParams.set("path", safePath);
  if (parentOrigin) {
    try {
      url.searchParams.set("parent", new URL(parentOrigin).origin);
    } catch {
      /* ignore bad parent */
    }
  }
  return url.toString();
}

/**
 * Whether a draft has changes that aren't live yet (no draft = nothing unpublished). Publishing
 * keeps the draft row as a copy of what went live, so only a differing draft counts. Compared as
 * resolved documents (both come from resolveThemeConfig, so key order matches).
 */
export function hasUnpublishedChanges(draft: unknown, published: unknown): boolean {
  return draft != null && JSON.stringify(draft) !== JSON.stringify(published);
}
