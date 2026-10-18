import "server-only";
import { listCategories } from "@/features/catalog/server/categories";
import { listSizeCharts } from "@/features/catalog/server/size-charts";
import { listManualCollections } from "@/features/catalog/server/collections";
import { getTenantTypeCatalogue } from "@/features/catalog/server/product-types";
import { categoryLabel } from "@/features/catalog/category-tree";
import { industryShort } from "@/features/stores/industries";

/** Picker options shared by the new/edit product pages. */
export async function productEditorOptions(tenantId: string) {
  const [categories, charts, collections, catalogue] = await Promise.all([listCategories(tenantId), listSizeCharts(tenantId), listManualCollections(tenantId), getTenantTypeCatalogue(tenantId)]);
  return {
    categories: categories.map((c) => ({ id: c.id, label: categoryLabel(c) })),
    sizeCharts: charts.map((c) => ({ id: c.id, label: c.name })),
    collections: collections.map((c) => ({ id: c.id, label: c.title })),
    types: catalogue.types,
    industry: catalogue.industry,
    industryName: catalogue.industry ? industryShort(catalogue.industry) : null,
  };
}
