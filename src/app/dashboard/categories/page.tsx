import type React from "react";
import type { Metadata } from "next";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { Badge, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { listCategories } from "@/features/catalog/server/categories";
import { listSizeCharts } from "@/features/catalog/server/size-charts";
import { categoryLabel } from "@/features/catalog/category-tree";
import { CategoryForm, DeleteCategory } from "@/features/catalog/components/catalog-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const ctx = await requireTenantPermission("catalog.read");
  const { t } = await getI18n();
  const [cats, charts] = await Promise.all([listCategories(ctx.tenantId, { withCounts: true }), listSizeCharts(ctx.tenantId)]);
  const sizeCharts = charts.map((c) => ({ id: c.id, label: c.name }));
  const chartName = new Map(charts.map((c) => [c.id, c.name]));
  const writable = can(ctx, "catalog.write");
  const parents = cats.map((c) => ({ id: c.id, label: categoryLabel(c) }));
  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.categories.title")} description={t("pages.categories.description")} />
      {writable ? (
        // Collapsible so the list (what sellers check most) stays near the top on phones;
        // open by default while the store has no categories yet.
        <details data-tour="category-add" open={cats.length === 0} className="group rounded-xl border border-border bg-surface shadow-xs">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-h3">Add category</span>
            <span aria-hidden className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-small font-medium text-primary-foreground group-open:hidden">
              + Add
            </span>
            <span aria-hidden className="hidden text-small text-muted group-open:inline">
              Close
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <CategoryForm parents={parents} sizeCharts={sizeCharts} />
          </div>
        </details>
      ) : null}
      {cats.length === 0 ? (
        <EmptyState title="No categories yet" description="Categories power store navigation and filters." />
      ) : (
        <ul data-tour="category-list" className="space-y-2">
          {cats.map((c) => (
            <li
              key={c.id}
              // Indent by depth, capped on phones so deep trees never push past the screen edge.
              style={{ "--depth": Math.min(c.depth, 4) } as React.CSSProperties}
              className="ml-[calc(var(--depth)*0.75rem)] min-w-0 rounded-xl border border-border bg-surface shadow-xs sm:ml-[calc(var(--depth)*1.5rem)]"
            >
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small category thumbnail
                      <img src={c.imageUrl} alt="" className="size-9 shrink-0 rounded-md object-cover ring-1 ring-border" />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-muted">
                        <span>{c.productCount} product{c.productCount === 1 ? "" : "s"}</span>
                        {c.status === "hidden" ? <Badge tone="neutral">Hidden</Badge> : null}
                        {c.sizeChartId && chartName.has(c.sizeChartId) ? <span className="truncate">· size chart: {chartName.get(c.sizeChartId)}</span> : null}
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-border px-3 text-caption font-medium text-muted group-open:bg-surface-secondary">
                    <span className="group-open:hidden">Edit</span>
                    <span className="hidden group-open:inline">Close</span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  {writable ? (
                    <>
                      <CategoryForm parents={parents} sizeCharts={sizeCharts} value={{ id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parentId, sizeChartId: c.sizeChartId, status: c.status, position: c.position, seoTitle: c.seoTitle, seoDescription: c.seoDescription, imageUrl: c.imageUrl }} />
                      <DeleteCategory id={c.id} name={c.name} />
                    </>
                  ) : (
                    <p className="text-sm text-muted">/categories/{c.slug}</p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
