import { enquiryFilterSchema, type EnquiryFilter } from "../schemas";

/** Filters from the URL (?status=&service=&from=&to=&page=), invalid values ignored. Pure. */
export function readEnquiryFilter(sp: Record<string, string | string[] | undefined>): EnquiryFilter {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const r = enquiryFilterSchema.safeParse({ status: one("status"), serviceId: one("service"), from: one("from"), to: one("to"), page: one("page") });
  return r.success ? r.data : { page: 1 };
}

export function enquiryFilterQuery(f: Partial<EnquiryFilter>, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (f.status) q.set("status", f.status);
  if (f.serviceId) q.set("service", f.serviceId);
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}
