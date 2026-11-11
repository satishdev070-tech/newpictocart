import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listEnquiries } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Enquiries" };

/** Leads (read-only list in M5; filters, notes, status changes and CSV export arrive in M7). */
export default async function InformativeEnquiriesPage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("customers.read")) redirect("/informative/dashboard");
  const { rows } = await listEnquiries(ctx, { page: 1 });
  return (
    <>
      <PageHeader title="Enquiries" description="People who contacted you through your website." />
      {rows.length === 0 ? (
        <EmptyState title="No enquiries yet" description="Tip: publish your website and share the link on WhatsApp and Instagram to get your first enquiry." />
      ) : (
        <Card>
          <Table caption="Enquiries">
            <thead>
              <tr>
                <th className={th}>Received</th>
                <th className={th}>Name</th>
                <th className={th}>Phone</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className={td}>{e.name}</td>
                  <td className={td}><a href={`tel:${e.phone}`} className="hover:underline">{e.phone}</a></td>
                  <td className={td}><Badge tone={e.status === "NEW" ? "accent" : e.status === "CONVERTED" ? "success" : "neutral"}>{e.status.toLowerCase()}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
