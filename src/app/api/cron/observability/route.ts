import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { isAuthorizedCronRequest } from "@/features/domains/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/observability/logger";

/**
 * Cron: retention cleanup for observability tables via `observability_cleanup` RPC
 * (service_role). Authorization: Bearer CRON_SECRET (same pattern as other crons).
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
  return NextResponse.json({ ok: true, result: data ?? null });
}
