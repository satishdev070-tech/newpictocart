/**
 * Lightweight span helpers for Phase 1 login-path instrumentation.
 * Works before any DB/OTel emit sink exists: measures wall time and optionally logs.
 * Never throw into callers — auth and routing must stay fail-soft.
 */

import { logger } from "@/lib/observability/logger";

export type TimingPart = { name: string; ms: number };

/** Wall-clock an async fn. Rethrows the original error unchanged (no ms on throw). */
export async function timeAsync<T>(_name: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - start };
}

/** RFC 7234-ish Server-Timing value: `name;dur=12.3, other;dur=4.0`. */
export function serverTimingHeader(parts: TimingPart[]): string {
  return parts
    .filter((p) => Number.isFinite(p.ms) && p.name.length > 0)
    .map((p) => `${sanitizeTimingName(p.name)};dur=${roundMs(p.ms)}`)
    .join(", ");
}

export function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

function sanitizeTimingName(name: string): string {
  // Server-Timing tokens: letters, digits, and a few punctuation chars; collapse anything else.
  return name.replace(/[^a-zA-Z0-9_./-]/g, "_").slice(0, 64);
}

/**
 * Login / observability span gate:
 * - `OBSERVABILITY_ENABLED=false` → never info (debug only)
 * - `OBSERVABILITY_ENABLED=true` → info
 * - `OBSERVABILITY_LOGIN_SPANS=1` → info for login spans even when global flag is unset
 *   (still suppressed when OBSERVABILITY_ENABLED=false)
 * Default (unset): debug only.
 */
export function shouldLogSpanAtInfo(): boolean {
  if (process.env.OBSERVABILITY_ENABLED === "false") return false;
  return process.env.OBSERVABILITY_ENABLED === "true" || process.env.OBSERVABILITY_LOGIN_SPANS === "1";
}

/** Emit `obs.span` — info when enabled, otherwise debug. Never throws. */
export function logSpan(fields: { span: string; ms: number; requestId?: string | null; [key: string]: unknown }): void {
  try {
    const payload = {
      ...fields,
      ms: roundMs(fields.ms),
      ...(fields.requestId ? { requestId: fields.requestId } : {}),
    };
    if (shouldLogSpanAtInfo()) logger.info("obs.span", payload);
    else logger.debug("obs.span", payload);
  } catch {
    // never break auth / routing
  }
}
