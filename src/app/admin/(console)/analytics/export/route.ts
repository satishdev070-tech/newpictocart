import { unstable_rethrow } from "next/navigation";
import { getPlatformContext } from "@/lib/platform/access";
import { AppError, HTTP_STATUS, toPublicError } from "@/lib/errors";
import { buildCsv, csvResponse } from "@/features/analytics/csv";
import { resolveDateRange } from "@/features/analytics/dates";
import { TRAFFIC_CSV_HEADER, trafficCsvRows } from "@/features/platform-analytics/report";
import { loadTrafficReport } from "@/features/platform-analytics/server/report";

/** CSV of the platform traffic report for the same range as the page (platform.settings.manage). */
export async function GET(request: Request) {
  try {
    const ctx = await getPlatformContext();
    if (!ctx || !ctx.permissions.has("platform.settings.manage")) throw new AppError("FORBIDDEN");
    const url = new URL(request.url);
    const p = (k: string) => url.searchParams.get(k);
    const range = resolveDateRange({ range: p("range") ?? (p("from") && p("to") ? "custom" : null), from: p("from"), to: p("to") });
    const res = await loadTrafficReport(range.fromKey, range.toKey, 100);
    if (!res.available) throw new AppError("NOT_FOUND", { message: "The visitor report isn't set up on this database yet." });
    return csvResponse(`platform-traffic-${range.fromKey}-to-${range.toKey}.csv`, buildCsv(TRAFFIC_CSV_HEADER, trafficCsvRows(res.report)));
  } catch (err) {
    unstable_rethrow(err);
    const e = toPublicError(err);
    return Response.json(e, { status: HTTP_STATUS[e.code] });
  }
}
