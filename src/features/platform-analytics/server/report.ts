import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { parseTrafficReport, type TrafficReport } from "../report";

export const PAGE_VIEWS_MIGRATION = "20261111007300_platform_page_views.sql";

/** Traffic report for an IST date range. `available: false` when the migration isn't applied or the read fails. */
export async function loadTrafficReport(fromKey: string, toKey: string, limit = 20): Promise<{ available: true; report: TrafficReport } | { available: false; reason: "missing" | "error" }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("platform_traffic_report", { p_from: fromKey, p_to: toKey, p_limit: limit });
    if (error) {
      const missing = ["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "");
      if (!missing) logger.warn("platform_traffic_report.failed", { code: error.code, message: error.message });
      return { available: false, reason: missing ? "missing" : "error" };
    }
    return { available: true, report: parseTrafficReport(data) };
  } catch (err) {
    logger.warn("platform_traffic_report.failed", { error: err });
    return { available: false, reason: "error" };
  }
}
