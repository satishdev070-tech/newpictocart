/**
 * Header allowlisting + deep redaction for observability payloads.
 * Uses the same secret/PII key spirit as logger.ts REDACT_KEYS.
 */

/** Same spirit as `logger.ts` REDACT_KEYS — secrets, tokens, PII-ish keys. */
export const REDACT_KEYS = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|service[-_]?role|signature|otp|card|cvv|phone|email/i;

const ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "cache-control",
  "content-length",
  "content-type",
  "host",
  "referer",
  "user-agent",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "x-request-id",
  "x-vercel-id",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d+$/;
/** Cuid / ulid style tokens (letter-prefixed, mixed alnum, no soft hyphens as words). */
const OPAQUE_ID_RE = /^[a-z][a-z0-9]{7,63}$/i;

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT_KEYS.test(k) ? "[redacted]" : redactValue(v, depth + 1)]),
    );
  }
  return value;
}

/** Keep only allowlisted headers; still redact values whose names match REDACT_KEYS. */
export function sanitizeHeaders(headers: Headers | Record<string, string | null | undefined> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;

  const entries: Array<[string, string]> =
    typeof (headers as Headers).forEach === "function"
      ? [...(headers as Headers).entries()]
      : Object.entries(headers as Record<string, string | null | undefined>).filter((e): e is [string, string] => typeof e[1] === "string");

  for (const [rawKey, rawVal] of entries) {
    const key = rawKey.toLowerCase();
    if (!ALLOWED_REQUEST_HEADERS.has(key)) continue;
    out[key] = REDACT_KEYS.test(key) ? "[redacted]" : rawVal.slice(0, 500);
  }
  return out;
}

function isIdSegment(seg: string): boolean {
  if (!seg) return false;
  if (UUID_RE.test(seg) || NUMERIC_ID_RE.test(seg)) return true;
  // Heuristic: cuid/ulid-ish tokens that also contain a digit.
  if (OPAQUE_ID_RE.test(seg) && /[0-9]/.test(seg)) return true;
  return false;
}

/**
 * Collapse dynamic path segments into templates, e.g.
 * `/dashboard/products/3fa85f64-…` → `/dashboard/products/[id]`.
 */
export function normalizeRoute(path: string): string {
  if (!path) return "/";
  let pathname = path;
  try {
    if (path.includes("://")) pathname = new URL(path).pathname;
  } catch {
    pathname = path.split("?")[0] ?? path;
  }
  pathname = pathname.split("?")[0]?.split("#")[0] || "/";
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const parts = pathname.split("/").map((seg) => {
    if (!seg) return seg;
    if (seg.startsWith("[") && seg.endsWith("]")) return seg;
    return isIdSegment(seg) ? "[id]" : seg;
  });

  let out = parts.join("/") || "/";
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}
