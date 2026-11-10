import { getSampleRate, getSlowMs, isObservabilityEnabled } from "./config";

/** Routes (and prefixes) that are always sampled when observability is on. */
export const SAMPLE_ALLOWLIST = ["/login", "/seller/login", "/admin", "/dashboard"] as const;

export type SampleInput = {
  route: string;
  status: number;
  durationMs: number;
  force?: boolean;
  /** Override env sample rate (tests). */
  sampleRate?: number;
  /** Override env slow threshold (tests). */
  slowMs?: number;
  /** Deterministic RNG in [0,1) for tests. */
  random?: () => number;
};

function isAllowlisted(route: string): boolean {
  const r = route.startsWith("/") ? route : `/${route}`;
  return SAMPLE_ALLOWLIST.some((prefix) => r === prefix || r.startsWith(`${prefix}/`));
}

/**
 * Always sample errors, slow requests, allowlisted routes, or `force`.
 * Otherwise apply the configured sample rate. Returns false when disabled
 * (unless `force` is set).
 */
export function shouldSample(input: SampleInput): boolean {
  if (input.force) return true;
  if (!isObservabilityEnabled()) return false;

  if (input.status >= 500 || input.status === 429) return true;
  const slowMs = input.slowMs ?? getSlowMs();
  if (input.durationMs >= slowMs) return true;
  if (isAllowlisted(input.route)) return true;

  const rate = input.sampleRate ?? getSampleRate();
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const rnd = input.random ?? Math.random;
  return rnd() < rate;
}
