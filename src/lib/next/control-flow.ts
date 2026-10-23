/**
 * Next.js throws special errors (dynamic bailout, redirect, not-found) that must
 * keep propagating. Catch-alls around session/DB I/O must rethrow these.
 */
export function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = "digest" in err ? String((err as { digest: unknown }).digest) : "";
  if (digest === "DYNAMIC_SERVER_USAGE") return true;
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return true;
  // Message fallback when digest is missing (older/prerender paths).
  const message = err instanceof Error ? err.message : "";
  return message.includes("Dynamic server usage") || message.includes("was not wrapped in a suspense boundary");
}
