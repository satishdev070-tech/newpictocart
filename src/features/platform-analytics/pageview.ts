/**
 * First-party page views for the platform's own pages. Pure (no I/O) so the beacon, the ingest
 * endpoint and tests share the same rules. Nothing personal is kept: no query strings, no
 * fragments, no IPs; the visitor id is a random per-tab session uuid.
 */

export const PAGEVIEW_ENDPOINT = "/api/analytics/pageview";
export const PAGEVIEW_SESSION_KEY = "pc_pv_sid";
export const MAX_BEACON_BYTES = 2048;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Path only, no query/fragment, max 300 chars; null for anything that isn't a site path. */
export function normalizePagePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/, 1)[0]!.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300 || /\s/.test(path)) return null;
  return path;
}

/** Referrer as origin + path (query dropped); android-app:// kept as-is; null = direct/invalid. */
export function normalizeReferrer(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const v = raw.trim();
  if (v.startsWith("android-app://")) return v.slice(0, 300);
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${u.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

export type PageviewInput = { sid: string; path: string; referrer: string | null };

/** Validates a beacon body (already JSON-parsed). */
export function parsePageview(body: unknown): PageviewInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const sid = typeof b.sid === "string" ? b.sid.toLowerCase() : "";
  if (!UUID_RE.test(sid)) return null;
  const path = normalizePagePath(b.path);
  if (!path) return null;
  return { sid, path, referrer: normalizeReferrer(b.ref) };
}

/** Paths that are never counted even if a beacon arrives for them (admin, APIs, internals). */
export function isTrackablePath(path: string): boolean {
  return !/^\/(admin|api|_next|store|dashboard)(\/|$)/.test(path);
}
