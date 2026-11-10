import { createHash } from "node:crypto";

/** Statuses that get an error fingerprint (client + server for Errors page visibility). */
export const ERROR_FINGERPRINT_STATUS_MIN = 400;

export type ErrorFingerprintInput = {
  routeTemplate: string;
  method: string;
  status: number;
  /** Optional message; truncated before hashing for stability. */
  message?: string | null;
};

/**
 * Stable fingerprint from route + method + status (+ truncated message).
 * Hex sha256 truncated to 32 chars (fits `error_fingerprint` / `fingerprint` ≤128).
 */
export function deriveErrorFingerprint(input: ErrorFingerprintInput): string {
  const method = (input.method || "GET").toUpperCase();
  const route = input.routeTemplate || "/";
  const msg = (input.message ?? "").trim().slice(0, 120);
  const key = `${method}|${input.status}|${route}|${msg}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/** Short default message when callers do not pass errorMessage. */
export function defaultErrorMessage(status: number, method: string, routeTemplate: string): string {
  return `${status} ${(method || "GET").toUpperCase()} ${routeTemplate || "/"}`.slice(0, 500);
}

/**
 * Resolve fingerprint + message for a request event.
 * Returns nulls when status is below the error threshold and no explicit fingerprint was given.
 */
export function resolveErrorFields(input: {
  status: number;
  method: string;
  routeTemplate: string;
  errorFingerprint?: string | null;
  errorMessage?: string | null;
}): { errorFingerprint: string | null; errorMessage: string | null } {
  const explicitFp = input.errorFingerprint?.trim() || null;
  const explicitMsg = input.errorMessage != null ? String(input.errorMessage).slice(0, 500) : null;

  if (explicitFp) {
    return {
      errorFingerprint: explicitFp.slice(0, 128),
      errorMessage: explicitMsg ?? defaultErrorMessage(input.status, input.method, input.routeTemplate),
    };
  }

  if (input.status < ERROR_FINGERPRINT_STATUS_MIN) {
    return { errorFingerprint: null, errorMessage: explicitMsg };
  }

  const errorMessage = explicitMsg ?? defaultErrorMessage(input.status, input.method, input.routeTemplate);
  return {
    errorFingerprint: deriveErrorFingerprint({
      routeTemplate: input.routeTemplate,
      method: input.method,
      status: input.status,
      message: explicitMsg,
    }),
    errorMessage,
  };
}
