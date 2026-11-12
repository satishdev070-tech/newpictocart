import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Mail, MessageCircle, Phone, X } from "lucide-react";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/states";
import { deleteEnquiryAction } from "@/features/informative/actions";
import { ENQUIRY_STATUS_LABELS, EnquiryUpdateForm } from "@/features/informative/panel/enquiry-form";
import { enquiryFilterQuery, readEnquiryFilter } from "@/features/informative/panel/enquiry-filters";
import { ENQUIRY_STATUSES } from "@/features/informative/schemas";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { ENQUIRIES_PAGE_SIZE, getEnquiry, listEnquiries, listServices } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Enquiries" };

const SOURCE = { CONTACT_FORM: "Contact form", SERVICE_PAGE: "Service page", WHATSAPP_CLICK: "WhatsApp tap" } as const;
const TONE = { NEW: "accent", CONTACTED: "info", CONVERTED: "success", CLOSED: "neutral" } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d}` : null;
};

/** Leads: filters (status, service, date), detail panel, status + private notes, click-to-contact, CSV. */
export default async function InformativeEnquiriesPage({ searchParams }: PageProps<"/informative/enquiries">) {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("customers.read")) redirect("/informative/dashboard");
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const filter = readEnquiryFilter(sp);
  const openId = typeof sp.open === "string" && /^[0-9a-f-]{36}$/.test(sp.open) ? sp.open : null;
  const [{ rows, total }, services, open] = await Promise.all([listEnquiries(ctx, filter), listServices(ctx), openId ? getEnquiry(ctx, openId) : Promise.resolve(null)]);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const pages = Math.max(1, Math.ceil(total / ENQUIRIES_PAGE_SIZE));
  const canWrite = ctx.permissions.has("customers.write");
  const qs = (extra: Record<string, string> = {}) => enquiryFilterQuery(filter, extra);
  const anyFilter = Boolean(filter.status || filter.serviceId || filter.from || filter.to);
  const input = "mt-1 block min-h-10 rounded-md border border-border bg-surface px-3";

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="People who contacted you through your website."
        actions={
          total ? (
            <a href={`/informative/enquiries/export${qs()}`} className={buttonClass({ variant: "secondary" })}>
              <Download aria-hidden /> Export CSV
            </a>
          ) : null
        }
      />
      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" aria-label="Filter enquiries">
          <label className="text-small font-medium">
            Status
            <select name="status" defaultValue={filter.status ?? ""} className={input}>
              <option value="">All</option>
              {ENQUIRY_STATUSES.map((s) => (
                <option key={s} value={s}>{ENQUIRY_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="text-small font-medium">
            Service
            <select name="service" defaultValue={filter.serviceId ?? ""} className={input}>
              <option value="">All</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-small font-medium">
            From
            <input type="date" name="from" defaultValue={filter.from ?? ""} className={input} />
          </label>
          <label className="text-small font-medium">
            To
            <input type="date" name="to" defaultValue={filter.to ?? ""} className={input} />
          </label>
          <button type="submit" className={buttonClass({ variant: "secondary" })}>Apply</button>
          {anyFilter ? <Link href="/informative/enquiries" className="text-small font-medium text-accent hover:underline">Clear</Link> : null}
        </form>
      </Card>

      <div className={open ? "grid gap-6 lg:grid-cols-[1fr_380px]" : ""}>
        {rows.length === 0 ? (
          <EmptyState
            title={anyFilter ? "No enquiries match these filters" : "No enquiries yet"}
            description={anyFilter ? "Try clearing a filter." : "Tip: publish your website and share the link on WhatsApp and Instagram to get your first enquiry."}
          />
        ) : (
          <Card>
            <Table caption={`Enquiries, page ${filter.page} of ${pages}`}>
              <thead>
                <tr>
                  <th className={th}>Received</th>
                  <th className={th}>Name</th>
                  <th className={th}>Service</th>
                  <th className={th}>Source</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} aria-current={e.id === openId ? "true" : undefined} className={e.id === openId ? "bg-surface-secondary" : undefined}>
                    <td className={td}>{when(e.createdAt)}</td>
                    <td className={td}>
                      <Link href={`/informative/enquiries${qs({ open: e.id, page: String(filter.page) })}`} className="font-medium hover:underline">
                        {e.name}
                      </Link>
                      <p className="text-caption text-muted">{e.phone}</p>
                    </td>
                    <td className={td}>{e.serviceId ? (serviceName.get(e.serviceId) ?? "—") : "—"}</td>
                    <td className={td}>{SOURCE[e.source]}</td>
                    <td className={td}><Badge tone={TONE[e.status]}>{ENQUIRY_STATUS_LABELS[e.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {pages > 1 ? (
              <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-small">
                {filter.page > 1 ? <Link href={`/informative/enquiries${qs({ page: String(filter.page - 1) })}`} className="font-medium text-accent hover:underline">← Newer</Link> : <span />}
                <span className="text-muted">Page {filter.page} of {pages}</span>
                {filter.page < pages ? <Link href={`/informative/enquiries${qs({ page: String(filter.page + 1) })}`} className="font-medium text-accent hover:underline">Older →</Link> : <span />}
              </nav>
            ) : null}
          </Card>
        )}

        {open ? (
          <Card
            title={open.name}
            description={`${SOURCE[open.source]} · ${when(open.createdAt)}`}
            actions={
              <Link href={`/informative/enquiries${qs({ page: String(filter.page) })}`} aria-label="Close details" className={buttonClass({ variant: "ghost", size: "sm" })}>
                <X aria-hidden />
              </Link>
            }
          >
            <div className="space-y-4 text-small">
              <div className="flex flex-wrap gap-2">
                {open.source !== "WHATSAPP_CLICK" ? (
                  <a href={`tel:${open.phone}`} className={buttonClass({ variant: "secondary", size: "sm" })}><Phone aria-hidden /> Call</a>
                ) : null}
                {open.source !== "WHATSAPP_CLICK" && waLink(open.phone) ? (
                  <a href={waLink(open.phone)!} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}><MessageCircle aria-hidden /> WhatsApp</a>
                ) : null}
                {open.email ? <a href={`mailto:${open.email}`} className={buttonClass({ variant: "secondary", size: "sm" })}><Mail aria-hidden /> Email</a> : null}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted">Phone</dt><dd>{open.phone}</dd>
                {open.email ? <><dt className="text-muted">Email</dt><dd className="break-all">{open.email}</dd></> : null}
                {open.serviceId ? <><dt className="text-muted">Service</dt><dd>{serviceName.get(open.serviceId) ?? "—"}</dd></> : null}
                {open.preferredDate || open.preferredTime ? <><dt className="text-muted">Preferred</dt><dd>{[open.preferredDate, open.preferredTime].filter(Boolean).join(" at ")}</dd></> : null}
              </dl>
              {open.message ? <p className="whitespace-pre-line rounded-md bg-surface-secondary p-3">{open.message}</p> : null}
              {canWrite ? (
                <>
                  <EnquiryUpdateForm id={open.id} status={open.status} notes={open.notes} />
                  <ConfirmButton action={deleteEnquiryAction} fields={{ id: open.id }} title="Delete this enquiry?" description="It's removed from your list." confirmLabel="Delete">
                    Delete enquiry
                  </ConfirmButton>
                </>
              ) : open.notes ? (
                <p><span className="text-muted">Notes:</span> {open.notes}</p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
