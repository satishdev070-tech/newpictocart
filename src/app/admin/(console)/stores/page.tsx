import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { STORE_TYPE_LABEL, storeListFilterSchema } from "@/features/platform/schemas";
import { listPlans, listStores } from "@/features/platform/server/queries";
import { StoresListFilters } from "@/features/platform/components/stores-filters";
import { Badge, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatDateTime } from "@/features/analytics/dates";
import { formatMoney } from "@/lib/money";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Stores" };
const TONE = { trial: "accent", active: "success", suspended: "error", cancelled: "neutral" } as const;
const TYPE_TONE = { real: "success", demo: "info", test: "warning" } as const;

export default async function StoresPage({ searchParams }: PageProps<"/admin/stores">) {
  const ctx = await requirePlatform("platform.tenants.read");
  const f = storeListFilterSchema.parse(await searchParams);
  const [{ rows, total, categories }, plans] = await Promise.all([listStores(f), listPlans()]);
  // Store type / category exist only once migration 1800 is applied (categories !== null).
  const typed = categories !== null;
  const type = typed ? f.type : undefined;
  const category = typed ? f.category : undefined;
  const filtered = Boolean(f.q || f.status || f.plan || f.from || f.to || type || category);
  return (
    <div>
      <PageHeader
        title="Stores"
        description={`${total} store${total === 1 ? "" : "s"}${filtered ? " match your filters" : " on the platform"}`}
        actions={
          ctx.permissions.has("platform.tenants.manage") ? (
            <Link href="/admin/tenants/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground">
              New store
            </Link>
          ) : null
        }
      />
      <StoresListFilters plans={plans} categories={categories} />
      {rows.length ? (
        // Compact list: the essentials on one line; select a row to see everything else.
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface" aria-label="Stores">
          {rows.map((t) => {
            const host = t.primaryDomain ?? storeSubdomain(t.slug);
            return (
              <li key={t.id}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto_auto] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        {typed && t.storeType ? <Badge tone={TYPE_TONE[t.storeType]}>{STORE_TYPE_LABEL[t.storeType]}</Badge> : null}
                      </span>
                      <span className="block truncate font-mono text-caption text-muted">{t.slug}</span>
                    </span>
                    <span className="flex items-center gap-2 justify-self-end md:justify-self-start">
                      <Badge tone={TONE[t.status]}>{t.status}</Badge>
                      <span className="text-small">{t.planName ?? "No plan"}</span>
                    </span>
                    <span className="col-span-2 truncate text-small text-muted md:col-span-1" title={host}>
                      {host}
                    </span>
                    <span className="hidden text-right text-small tabular-nums md:block">
                      {t.orders} {t.orders === 1 ? "order" : "orders"}
                    </span>
                    <span aria-hidden className="hidden text-muted transition-transform group-open:rotate-180 md:block">
                      ▾
                    </span>
                  </summary>
                  <div className="grid gap-4 border-t border-border bg-surface-secondary/50 px-4 py-4 text-small sm:grid-cols-2 lg:grid-cols-4">
                    <dl className="space-y-1">
                      <dt className="text-caption text-muted">Owner</dt>
                      <dd className="break-all">{t.ownerEmail ?? "No owner"}</dd>
                      {typed ? (
                        <>
                          <dt className="pt-2 text-caption text-muted">Category</dt>
                          <dd>{t.categoryName ?? "—"}</dd>
                        </>
                      ) : null}
                    </dl>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <dt className="text-muted">Products</dt>
                      <dd className="text-right tabular-nums">{t.products}</dd>
                      <dt className="text-muted">Orders</dt>
                      <dd className="text-right tabular-nums">{t.orders}</dd>
                      <dt className="text-muted">Customers</dt>
                      <dd className="text-right tabular-nums">{t.customers}</dd>
                      <dt className="text-muted">Revenue</dt>
                      <dd className="text-right tabular-nums">{formatMoney(t.revenueMinor)}</dd>
                    </dl>
                    <dl className="space-y-1">
                      <dt className="text-caption text-muted">Created</dt>
                      <dd>{formatDate(t.createdAt)}</dd>
                      <dt className="pt-2 text-caption text-muted">Last activity</dt>
                      <dd>{t.lastActivity ? formatDateTime(t.lastActivity) : "—"}</dd>
                    </dl>
                    <div className="flex flex-wrap content-start gap-2">
                      <Link href={`/admin/tenants/${t.id}`} className="inline-flex h-8 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground">
                        Manage store
                      </Link>
                      <a href={storeOrigin(host)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 font-medium hover:bg-background">
                        Open storefront <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                      <p className="w-full break-all font-mono text-caption text-muted">ID {t.id}</p>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={filtered ? "No stores match" : "No stores yet"} description={filtered ? "Try a different search or clear the filters." : "Stores appear here as sellers sign up."} />
      )}
      <Pagination page={f.page} pageSize={f.pageSize} total={total} basePath="/admin/stores" params={{ q: f.q, status: f.status, plan: f.plan, from: f.from, to: f.to, sort: f.sort === "newest" ? undefined : f.sort, type, category }} />
    </div>
  );
}
