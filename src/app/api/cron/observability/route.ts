import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { isAuthorizedCronRequest } from "@/features/domains/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";
import { evaluateAndRecordAlertsForCron } from "@/features/observability/server/alerts";

/**
 * Cron: retention cleanup (`observability_cleanup`) then alert evaluation.
 * Authorization: Bearer CRON_SECRET (same pattern as other crons).
 * Alert evaluation soft-fails — cleanup result is still returned.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createSupabaseAdminClient().rpc("observability_cleanup");
  if (error) {
    logger.error("cron.observability_cleanup_failed", { error: error.message });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  let alerts: { ok: true; proposed: number } | { ok: false; error: string } = { ok: true, proposed: 0 };
  try {
    const proposed = await evaluateAndRecordAlertsForCron();
    alerts = { ok: true, proposed: proposed.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("cron.observability_alerts_failed", { error: message });
    alerts = { ok: false, error: message };
  }

  return NextResponse.json({ ok: true, result: data ?? null, alerts });
}
