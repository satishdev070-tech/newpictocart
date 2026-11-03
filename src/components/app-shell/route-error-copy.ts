/** True when the failure looks like a timed-out / dropped RSC flight (not an app bug). */
export function isNetworkRouteError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network error") ||
    m.includes("failed to fetch") ||
    m.includes("fetch failed") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("err_timed_out") ||
    m.includes("load failed") ||
    m.includes("aborted")
  );
}

export function routeErrorDescription(error: Error & { digest?: string }): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isNetworkRouteError(message)) {
    return "The connection timed out or dropped while loading. Check your network and try again.";
  }
  if (error.digest) return `Reference: ${error.digest}`;
  return "Please try again.";
}
