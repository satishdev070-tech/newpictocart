import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { listManualCollections } from "@/features/catalog/server/collections";
import { getTenantTypeCatalogue } from "@/features/catalog/server/product-types";
import { flattenCategoryTree, categoryLabel } from "@/features/catalog/category-tree";
import { categorySizeChartId } from "@/features/catalog/size-chart";
import { industryShort } from "@/features/stores/industries";

/** Picker options shared by the new/edit product pages (lean id/name selects). */
export async function productEditorOptions(tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const [catsRes, chartsRes, collections, catalogue] = await Promise.all([
    // id + name (+ parent/position/size_chart_id for labels and inherited charts — no SEO/images)
    supabase.from("categories").select("id, parent_id, name, position, size_chart_id").eq("tenant_id", tenantId).order("position").limit(2000),
    supabase.from("size_charts").select("id, name").eq("tenant_id", tenantId).order("name").limit(500),
    listManualCollections(tenantId),
    getTenantTypeCatalogue(tenantId),
  ]);
  if (catsRes.error) throw mapDbError(catsRes.error);
  if (chartsRes.error) throw mapDbError(chartsRes.error);
  const categories = flattenCategoryTree(
    (catsRes.data ?? []).map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      position: c.position,
      sizeChartId: c.size_chart_id,
    })),
  );
  return {
    categories: categories.map((c) => ({ id: c.id, label: categoryLabel(c) })),
    sizeCharts: (chartsRes.data ?? []).map((c) => ({ id: c.id, label: c.name })),
    /** Category id → the chart its products inherit (own or a parent's). */
    categorySizeCharts: Object.fromEntries(
      categories.flatMap((c) => {
        const chart = categorySizeChartId(categories, c.id);
        return chart ? [[c.id, chart]] : [];
      }),
    ) as Record<string, string>,
    collections: collections.map((c) => ({ id: c.id, label: c.title })),
    types: catalogue.types,
    industry: catalogue.industry,
    industryName: catalogue.industry ? industryShort(catalogue.industry) : null,
  };
}
