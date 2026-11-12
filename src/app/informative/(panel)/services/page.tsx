import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { duplicateServiceAction, toggleServiceAction } from "@/features/informative/actions";
import { formatDuration, formatServicePrice } from "@/features/informative/pricing";
import { RowControls } from "@/features/informative/panel/ui";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { listServices } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Services" };

function Toggle({ id, field, on, label }: { id: string; field: "isActive" | "isFeatured"; on: boolean; label: string }) {
  return (
    <form action={toggleServiceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "false" : "true"} />
      <button type="submit" aria-pressed={on} className="rounded-md px-2 py-1 text-caption font-medium hover:bg-surface-secondary" aria-label={`${label}: ${on ? "on" : "off"}`}>
        {on ? <Badge tone="success">{label}</Badge> : <Badge tone="neutral">Not {label.toLowerCase()}</Badge>}
      </button>
    </form>
  );
}

/** Services: search, category filter, add/edit/delete, reorder, active/featured toggles, duplicate. */
export default async function InformativeServicesPage({ searchParams }: PageProps<"/informative/services">) {
  const ctx = await requireInformativeTenant();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 80) : "";
  const cat = typeof sp.category === "string" ? sp.category : "";
  const all = await listServices(ctx);
  const categories = [...new Set(all.map((s) => s.category).filter((c): c is string => Boolean(c)))].sort();
  const filtered = all.filter((s) => (!q || `${s.name} ${s.shortDescription ?? ""}`.toLowerCase().includes(q)) && (!cat || s.category === cat));
  const canWrite = ctx.permissions.has("content.write");
  const reorderable = !q && !cat;

  return (
    <>
      <PageHeader title="Services" description="What you offer. Visitors see active services on your website." actions={canWrite ? <Link href="/informative/services/new" className={buttonClass()}>Add service</Link> : null} />
      {all.length === 0 ? (
        <EmptyState title="No services yet" description="Tip: add your 3 most popular services first, with a clear price or 'Price on request'." action={canWrite ? <Link href="/informative/services/new" className={buttonClass()}>Add service</Link> : undefined} />
      ) : (
        <Card>
          <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
            <label className="text-small font-medium">
              Search
              <input name="q" defaultValue={q} className="mt-1 block min-h-10 rounded-md border border-border bg-surface px-3" />
            </label>
            {categories.length ? (
              <label className="text-small font-medium">
                Category
                <select name="category" defaultValue={cat} className="mt-1 block min-h-10 rounded-md border border-border bg-surface px-3">
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit" className={buttonClass({ variant: "secondary" })}>Filter</button>
          </form>
          {!reorderable ? <p className="mb-2 text-caption text-muted">Clear the filters to reorder.</p> : null}
          <Table caption="Services">
            <thead>
              <tr>
                <th className={th}>Service</th>
                <th className={th}>Price</th>
                <th className={th}>Status</th>
                {canWrite ? <th className={th}><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td className={td}>
                    <Link href={`/informative/services/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    {s.isSample ? <> <Badge tone="accent">Sample</Badge></> : null}
                    {s.category ? <p className="text-caption text-muted">{s.category}</p> : null}
                  </td>
                  <td className={td}>
                    {formatServicePrice(s.priceType, s.pricePaise) ?? "Hidden"}
                    {s.durationMinutes ? <p className="text-caption text-muted">{formatDuration(s.durationMinutes)}</p> : null}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {canWrite ? <Toggle id={s.id} field="isActive" on={s.isActive} label="Active" /> : s.isActive ? <Badge tone="success">Active</Badge> : null}
                      {canWrite ? <Toggle id={s.id} field="isFeatured" on={s.isFeatured} label="Featured" /> : null}
                    </div>
                  </td>
                  {canWrite ? (
                    <td className={td}>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <form action={duplicateServiceAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className={buttonClass({ variant: "ghost", size: "sm" })}>Duplicate</button>
                        </form>
                        <RowControls kind="services" id={s.id} label={s.name} first={!reorderable || i === 0} last={!reorderable || i === filtered.length - 1} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
