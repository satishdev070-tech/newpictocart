/**
 * Schedule a sampled request event from the proxy (fail-soft).
 * Avoids `server-only` so the proxy bundle can load this shell; emit is
 * dynamically imported inside `after()` and may no-op on edge/runtime limits.
 */

import { after } from "next/server";

export type ProxyObserveInput = {
  requestId?: string;
  route: string;
  method?: string;
  durationMs: number;
  status?: number;
  spans?: unknown;
  forceSample?: boolean;
};

/**
 * Record a sampled proxy-pass request after the response is sent.
 * Never throws into the proxy.
 */
export function observeProxyRequest(input: ProxyObserveInput): void {
  try {
    const durationMs = Math.max(0, Math.round(input.durationMs));
    const requestId = input.requestId;
    const route = input.route || "/";
    const method = (input.method ?? "GET").toUpperCase();
    const status = input.status ?? 200;
    const spans = input.spans;
    const forceSample = input.forceSample;
    after(() => {
      void (async () => {
        try {
          const { recordRequestEvent } = await import("@/lib/observability/server/emit");
          recordRequestEvent({
            requestId,
            traceId: requestId,
            routeTemplate: route,
            route,
            method,
            status,
            durationMs,
            spans,
            forceSample,
            attrs: { surface: "proxy" },
          });
        } catch {
          // never break routing
        }
      })();
    });
  } catch {
    // outside a Next request or after() unavailable — ignore
  }
}
