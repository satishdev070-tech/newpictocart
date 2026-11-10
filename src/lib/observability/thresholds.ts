/** Latency health bands for request duration (ms). */

export type DurationClass = "healthy" | "moderate" | "slow" | "critical";

export const DURATION_THRESHOLDS = {
  healthy: 300,
  moderate: 800,
  slow: 2000,
} as const;

/** healthy <300, moderate 300–800, slow 800–2000, critical >2000. */
export function classifyDuration(ms: number): DurationClass {
  const n = Number.isFinite(ms) ? ms : 0;
  if (n < DURATION_THRESHOLDS.healthy) return "healthy";
  if (n < DURATION_THRESHOLDS.moderate) return "moderate";
  if (n <= DURATION_THRESHOLDS.slow) return "slow";
  return "critical";
}
