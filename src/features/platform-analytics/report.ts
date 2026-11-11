/** Shapes for the Super Admin traffic report (platform_traffic_report RPC). Pure. */

export type TrafficDay = { day: string; visitors: number; views: number };
export type TrafficRow = { key: string; views: number; visitors: number };
export type TrafficReport = {
  visitors: number;
  views: number;
  visitorsToday: number;
  viewsToday: number;
  daily: TrafficDay[];
  topPages: TrafficRow[];
  topReferrers: TrafficRow[];
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : []);

export function parseTrafficReport(json: unknown): TrafficReport {
  const j = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    visitors: num(j.visitors),
    views: num(j.views),
    visitorsToday: num(j.visitors_today),
    viewsToday: num(j.views_today),
    daily: arr(j.daily).map((d) => ({ day: String(d.day ?? ""), visitors: num(d.visitors), views: num(d.views) })),
    topPages: arr(j.top_pages).map((r) => ({ key: String(r.path ?? ""), views: num(r.views), visitors: num(r.visitors) })),
    topReferrers: arr(j.top_referrers).map((r) => ({ key: String(r.referrer ?? "(direct)"), views: num(r.views), visitors: num(r.visitors) })),
  };
}

/** Pages per visit, 2 decimals; 0 when there are no visitors. */
export function pagesPerVisit(r: Pick<TrafficReport, "visitors" | "views">): number {
  return r.visitors > 0 ? Math.round((r.views / r.visitors) * 100) / 100 : 0;
}

export const TRAFFIC_CSV_HEADER = ["Section", "Key", "Visitors", "Page views"] as const;

/** One CSV covering totals, daily rows, top pages and top referrers. */
export function trafficCsvRows(r: TrafficReport): (string | number)[][] {
  return [
    ["Total", "Visitors / page views", r.visitors, r.views],
    ...r.daily.map((d) => ["Daily", d.day, d.visitors, d.views]),
    ...r.topPages.map((p) => ["Top page", p.key, p.visitors, p.views]),
    ...r.topReferrers.map((p) => ["Top referrer", p.key, p.visitors, p.views]),
  ];
}
