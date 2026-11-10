"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { routeErrorDescription } from "./route-error-copy";

export type RouteErrorProps = {
  error: Error & { digest?: string };
  /** Next.js 16.3+ recovery — re-fetches the segment. */
  retry?: () => void;
  /** Older dual name — same recovery when `retry` is absent. */
  reset?: () => void;
};

export { isNetworkRouteError, routeErrorDescription } from "./route-error-copy";

function recover(retry?: () => void, reset?: () => void) {
  if (typeof retry === "function") retry();
  else if (typeof reset === "function") reset();
}

/**
 * Shared panel route error UI. Call recover only from the button — never from useEffect —
 * so retry under load cannot spin into React max-update-depth loops.
 */
export function PanelRouteError({
  error,
  retry,
  reset,
  logMsg,
  title = "This page couldn't load",
}: RouteErrorProps & { logMsg: string; title?: string }) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
    console.error(JSON.stringify({ level: "error", msg: logMsg, digest: digest || null, message, time: new Date().toISOString() }));
  }, [error, logMsg]);

  return (
    <ErrorState
      title={title}
      description={routeErrorDescription(error)}
      action={
        <Button variant="secondary" onClick={() => recover(retry, reset)}>
          Try again
        </Button>
      }
    />
  );
}
