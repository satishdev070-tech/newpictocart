/**
 * Single-flight guard for `finalizeStartDraftAction`.
 *
 * After email OTP the server redirects to /start → /start/lang and the client then replaces the
 * URL with /start/account. Each URL change can remount `StartJourney`, which resets its
 * `finalizing` ref; the signed-in effect then started a SECOND finalize while the first was still
 * creating + seeding the store. Two seeds raced on one tenant (same slugs/SKUs) and the seller saw
 * "sample products couldn't be saved" and, on retry, "The store could not be finished".
 *
 * Module scope survives remounts within the tab, so every caller shares the one in-flight call.
 */
let inFlight: Promise<unknown> | null = null;

export function finalizeOnce<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight) return inFlight as Promise<T>;
  const p = run().finally(() => {
    if (inFlight === p) inFlight = null;
  });
  inFlight = p;
  return p;
}

/** True while a finalize call is running in this tab (for UI: keep showing the building screen). */
export function isFinalizeInFlight(): boolean {
  return inFlight !== null;
}

/** Test helper. */
export function resetFinalizeOnce(): void {
  inFlight = null;
}
