import { buildCsv, csvResponse } from "@/features/analytics/csv";
import { readEnquiryFilter } from "@/features/informative/panel/enquiry-filters";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listEnquiriesForExport, listServices } from "@/features/informative/server/repo";

/** CSV export of the filtered leads (customers.read). Formula injection is neutralised by buildCsv. */
export async function GET(request: Request) {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("customers.read")) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { page: _page, ...filter } = readEnquiryFilter(sp);
  const [rows, services] = await Promise.all([listEnquiriesForExport(ctx, filter), listServices(ctx)]);
  const names = new Map(services.map((s) => [s.id, s.name]));
  const csv = buildCsv(
    ["Received", "Name", "Phone", "Email", "Service", "Preferred date", "Preferred time", "Message", "Source", "Status", "Notes"],
    rows.map((e) => [new Date(e.createdAt), e.name, e.phone, e.email, e.serviceId ? (names.get(e.serviceId) ?? "") : "", e.preferredDate, e.preferredTime, e.message, e.source, e.status, e.notes]),
  );
  return csvResponse(`enquiries-${ctx.tenantSlug}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
