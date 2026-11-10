/** Shared buffer row shapes (no server-only — used by emit + ingest). */

export type BufferedRequestEvent = {
  request_id: string;
  trace_id: string;
  timestamp: string;
  environment: string;
  service: string;
  route_template: string;
  method: string;
  status: number;
  duration_ms: number;
  tenant_id: string | null;
  user_id: string | null;
  error_fingerprint: string | null;
  error_message: string | null;
  spans: unknown;
  attrs: Record<string, unknown>;
};

export type BufferedEndpointMetric = {
  time_bucket: string;
  environment: string;
  service: string;
  route_template: string;
  method: string;
  request_count: number;
  error_count: number;
  slow_count: number;
  latency_sum_ms: number;
  latency_bucket_counts: number[];
};
