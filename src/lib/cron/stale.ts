/**
 * Staleness guards for scheduled jobs (ADR-042). Cron runs can be late or missing for long
 * stretches (GitHub schedules are best-effort; production went weeks without any), so work that
 * only makes sense on time is expired instead of being done late:
 *  - a social post more than SOCIAL_POST_MAX_LATE_HOURS past its slot is marked failed (the seller
 *    sees it in the planner and reschedules) instead of being published days late;
 *  - a WhatsApp retry first queued more than WHATSAPP_RETRY_MAX_AGE_HOURS ago is dropped instead of
 *    reaching the customer long after the order event it describes.
 */
export const SOCIAL_POST_MAX_LATE_HOURS = 6;
export const WHATSAPP_RETRY_MAX_AGE_HOURS = 24;

/** ISO timestamp `hours` before `nowMs`: rows older than this are stale. */
export function staleBefore(hours: number, nowMs: number = Date.now()): string {
  return new Date(nowMs - hours * 3_600_000).toISOString();
}
