/** Public observability helpers (non–server-only). Import recordRequestEvent from `./server/emit`. */

export {
  getObservabilityConfig,
  getMetricsRetentionDays,
  getRetentionDays,
  getSampleRate,
  getSlowMs,
  isObservabilityEnabled,
} from "./config";
export { estimatePercentile, emptyHistogram, LATENCY_BUCKET_MS, mergeHistograms, recordLatency, type LatencyHistogram } from "./metrics";
export {
  generateId,
  getRequestContext,
  getRequestLogFields,
  runWithRequestContext,
  setRequestContext,
  type RequestObservabilityContext,
  type SpanRecord,
} from "./request-context";
export { normalizeRoute, redactValue, sanitizeHeaders, REDACT_KEYS } from "./sanitization";
export { SAMPLE_ALLOWLIST, shouldSample, type SampleInput } from "./sampling";
export { endSpan, startSpan, withSpan, type Span, type SpanStatus } from "./spans";
export { classifyDuration, DURATION_THRESHOLDS, type DurationClass } from "./thresholds";
