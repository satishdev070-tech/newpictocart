import "server-only";
import { after } from "next/server";

export type LoginObserveInput = {
  requestId?: string;
  durationMs: number;
  status?: number;
  spans?: unknown;
  forceSample?: boolean;
};

/**
 * Record a sampled `/login` GET request event after the response is sent.
 * Dynamic-import emit so this module stays safe if edge/bundling quirks appear.
 * Never throws into the sign-in page.
 */
export function observeLoginPage(input: LoginObserveInput): void {
  try {
    const durationMs = Math.max(0, Math.round(input.durationMs));
    const requestId = input.requestId;
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
            routeTemplate: "/login",
            route: "/login",
            method: "GET",
            status,
            durationMs,
            spans,
            forceSample,
            attrs: { surface: "shared_sign_in" },
          });
        } catch {
          // never break auth
        }
      })();
    });
  } catch {
    // outside a Next request or after() unavailable — ignore
  }
}
