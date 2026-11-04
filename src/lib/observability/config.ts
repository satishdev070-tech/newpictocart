/**
 * Observability feature flags and thresholds from env.
 * Defaults keep the feature off until explicitly enabled in a deployment.
 */

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function parseNumber(raw: string | undefined, fallback: number, opts?: { min?: number; max?: number }): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (opts?.min != null) out = Math.max(opts.min, out);
  if (opts?.max != null) out = Math.min(opts.max, out);
  return out;
}

/** Master switch. Default false. */
export function isObservabilityEnabled(): boolean {
  return parseBool(process.env.OBSERVABILITY_ENABLED, false);
}

/** Fraction of non-forced requests to keep (0–1). Default 0.1. */
export function getSampleRate(): number {
  return parseNumber(process.env.OBSERVABILITY_SAMPLE_RATE, 0.1, { min: 0, max: 1 });
}

/** Duration (ms) at/above which a request is always sampled and counted slow. Default 800. */
export function getSlowMs(): number {
  return parseNumber(process.env.OBSERVABILITY_SLOW_MS, 800, { min: 0 });
}

/** Days to retain raw request events. Default 14. */
export function getRetentionDays(): number {
  return parseNumber(process.env.OBSERVABILITY_RETENTION_DAYS, 14, { min: 1 });
}

/** Days to retain rolled-up endpoint metrics. Default 90. */
export function getMetricsRetentionDays(): number {
  return parseNumber(process.env.OBSERVABILITY_METRICS_RETENTION_DAYS, 90, { min: 1 });
}

export function getObservabilityConfig() {
  return {
    enabled: isObservabilityEnabled(),
    sampleRate: getSampleRate(),
    slowMs: getSlowMs(),
    retentionDays: getRetentionDays(),
    metricsRetentionDays: getMetricsRetentionDays(),
  };
}
