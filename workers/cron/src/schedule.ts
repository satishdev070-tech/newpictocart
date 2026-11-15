/**
 * Which /api/cron/* jobs each Cron Trigger runs (ADR-043). Kept in sync with the routes and with
 * `.github/workflows/cron.yml` (manual runs) by tests/unit/ci/cron-worker.test.ts.
 * Workers Free allows 5 Cron Triggers per account; this uses 3.
 */
export const SCHEDULES: Readonly<Record<string, readonly string[]>> = {
  "*/5 * * * *": ["expire-orders", "notifications"], // 30-min stock holds; notification retries
  "7,37 * * * *": ["social-publish", "domains"],
  "23 2 * * *": ["gbp-reviews", "observability"],
};
