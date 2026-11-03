import { logger } from "@/lib/observability/logger";

type QueryResult<T> = { data: T; error: { message?: string; code?: string } | null } | null;

/** Soft-fail a PostgREST result so one flaky RPC cannot pink-screen the dashboard home. */
export function softData<T>(r: QueryResult<T>, op: string): T | null {
  if (!r) return null;
  if (r.error) {
    logger.warn("analytics.home_query_failed", { op, code: r.error.code, message: r.error.message });
    return null;
  }
  return r.data;
}

export function softCount(r: QueryResult<unknown> & { count?: number | null } | null, op: string): number {
  if (!r) return 0;
  if (r.error) {
    logger.warn("analytics.home_query_failed", { op, code: r.error.code, message: r.error.message });
    return 0;
  }
  return r.count ?? 0;
}
