import type { Metadata } from "next";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { Card, PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { listSizeCharts } from "@/features/catalog/server/size-charts";
import { listCategories } from "@/features/catalog/server/categories";
import { categoryLabel } from "@/features/catalog/category-tree";
import { DeleteSizeChart, SizeChartForm } from "@/features/catalog/components/catalog-forms";

export const metadata: Metadata = { title: "Size charts" };

export default async function SizeChartsPage() {
  const ctx = await requireTenantPermission("catalog.read");
  const [charts, cats] = await Promise.all([listSizeCharts(ctx.tenantId, { withCounts: true }), listCategories(ctx.tenantId)]);
  const categories = cats.map((c) => ({ id: c.id, label: categoryLabel(c) }));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const writable = can(ctx, "catalog.write");
  return (
    <div className="space-y-6">
      <PageHeader title="Size charts" description="Shown as a size chart on product pages. Apply a chart to categories, or pick one per product in the product editor." />
      {charts.length === 0 && !writable ? <EmptyState title="No size charts yet" /> : null}
      {charts.map((c) => (
        <Card key={c.id} title={c.name} description={[c.categoryIds.length ? `Categories: ${c.categoryIds.map((id) => catName.get(id)).filter(Boolean).join(", ")}` : "No categories", `${c.productCount} products picked it`, c.unit === "cm" ? "centimetres" : "inches"].join(" · ")} actions={writable ? <DeleteSizeChart id={c.id} name={c.name} /> : null}>
          {writable ? <SizeChartForm value={{ id: c.id, name: c.name, unit: c.unit, chart: c.chart, categoryIds: c.categoryIds }} categories={categories} /> : <p className="text-sm text-muted">{c.chart.columns.join(" · ")}</p>}
        </Card>
      ))}
      {writable ? (
        <Card title="New size chart">
          <SizeChartForm categories={categories} />
        </Card>
      ) : null}
    </div>
  );
}
