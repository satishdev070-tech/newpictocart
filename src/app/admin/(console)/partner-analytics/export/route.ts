import { unstable_rethrow } from "next/navigation";
import { getPlatformContext } from "@/lib/platform/access";
import { AppError, HTTP_STATUS, toPublicError } from "@/lib/errors";
import { buildCsv, csvResponse } from "@/features/analytics/csv";
import { istDateKey } from "@/features/analytics/dates";
import { LEADERBOARD_CSV_HEADER, analyticsFilterSchema, leaderboardCsvRows, resolveAnalyticsRange } from "@/features/partners/schemas";
import { partnerLeaderboard } from "@/features/partners/server";

/** CSV of the partner leaderboard for the same filters as the page (platform.finance.read). */
export async function GET(request: Request) {
  try {
    const ctx = await getPlatformContext();
    if (!ctx || !ctx.permissions.has("platform.finance.read")) throw new AppError("FORBIDDEN");
    const url = new URL(request.url);
    const f = analyticsFilterSchema.parse(Object.fromEntries(url.searchParams));
    const range = resolveAnalyticsRange(f, istDateKey(new Date()));
    const res = await partnerLeaderboard(range.from, range.to, f.rank);
    if (!res.available) throw new AppError("NOT_FOUND", { message: "Partner tables are not installed." });
    return csvResponse(`partner-leaderboard-${range.from}-to-${range.to}.csv`, buildCsv(LEADERBOARD_CSV_HEADER, leaderboardCsvRows(res.data)));
  } catch (err) {
    unstable_rethrow(err);
    const e = toPublicError(err);
    return Response.json(e, { status: HTTP_STATUS[e.code] });
  }
}
