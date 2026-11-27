import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { formatMoney } from "@/lib/money";
import { Badge, PageHeader, Table, td, th } from "@/components/ui/layout";
import { SelectField, TextField } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { FilterBar, queryString } from "@/features/settings/ui/filter-bar";
import { listProducts, listUsedProductTypes } from "@/features/catalog/server/products";
import { listCategoryFilterOptions } from "@/features/catalog/server/categories";
import { listCollectionOptions } from "@/features/catalog/server/collections";
import { productListQuerySchema, PRODUCT_SORT_LABELS, PRODUCT_SORTS } from "@/features/catalog/schemas";
import { PRODUCT_PAGE_SIZE, PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONE } from "@/features/catalog/constants";
import { typeLabel } from "@/features/catalog/product-types";
import { getTenantTypeCatalogue } from "@/features/catalog/server/product-types";
import { categoryLabel } from "@/features/catalog/category-tree";
import { ProductBulkBar } from "@/features/catalog/components/catalog-forms";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/dashboard/products">) {
  const ctx = await requireTenantPermission("catalog.read");
  const { t } = await getI18n();
  const sp = await searchParams;
  const f = productListQuerySchema.parse(sp);
  const [{ rows, total }, categories, collections, catalogue, usedTypes] = await Promise.all([
    listProducts(ctx.tenantId, f),
    listCategoryFilterOptions(ctx.tenantId),
    listCollectionOptions(ctx.tenantId),
    getTenantTypeCatalogue(ctx.tenantId),
    listUsedProductTypes(ctx.tenantId),
  ]);
  // Type filter shows only types actually used on products (keep a deep-linked current filter visible).
  const typeKeys = f.type && !usedTypes.includes(f.type) ? [...usedTypes, f.type] : usedTypes;
  const typeOptions = typeKeys.map((key) => ({ value: key, label: typeLabel(key, catalogue.types) }));
  const params = { q: f.q, status: f.status, type: f.type, category: f.category, collection: f.collection, sort: f.sort };
  const filtered = Boolean(f.q || f.status || f.type || f.category || f.collection);
  const writable = can(ctx, "catalog.write");
  return (
    <div>
      <PageHeader
        title={t("pages.products.title")}
        description={total === 1 ? t("pages.products.countOne") : t("pages.products.count", { count: total })}
        actions={
          <>
            {writable ? (
              <Link href="/dashboard/products/new" className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:hidden">
                Add product
              </Link>
            ) : null}
            <a href={`/dashboard/products/export${queryString(params)}`} className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium" download>
              Export CSV
            </a>
            {writable ? (
              <>
                <Link href="/dashboard/products/import" className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium">
                  Import
                </Link>
                <Link href="/dashboard/products/new" className="hidden h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:inline-flex">
                  Add product
                </Link>
              </>
            ) : null}
          </>
        }
      />
      {sp.deleted ? <p role="status" className="mb-4 text-sm text-success">Product deleted.</p> : null}
      <FilterBar action="/dashboard/products" resetHref="/dashboard/products" label="Filter products" active={filtered}>
        <TextField label="Search" name="q" type="search" defaultValue={f.q ?? ""} placeholder="Title or SKU" className="sm:col-span-2" />
        <SelectField label="Status" name="status" defaultValue={f.status ?? ""} options={[{ value: "", label: "Any status" }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: PRODUCT_STATUS_LABELS[s] }))]} />
        <SelectField label="Type" name="type" defaultValue={f.type ?? ""} options={[{ value: "", label: "Any type" }, ...typeOptions]} />
        <SelectField label="Category" name="category" defaultValue={f.category ?? ""} options={[{ value: "", label: "Any category" }, ...categories.map((c) => ({ value: c.id, label: categoryLabel(c) }))]} />
        <SelectField label="Collection" name="collection" defaultValue={f.collection ?? ""} options={[{ value: "", label: "Any collection" }, ...collections.map((c) => ({ value: c.id, label: c.title }))]} />
        <SelectField label="Sort" name="sort" defaultValue={f.sort} options={PRODUCT_SORTS.map((s) => ({ value: s, label: PRODUCT_SORT_LABELS[s] }))} />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No products match these filters" : "Add your first product"}
          description={filtered ? "Try a different search or clear the filters." : "Products appear on your storefront once they're active."}
          action={!filtered && writable ? <Link href="/dashboard/products/new" className="text-sm font-medium text-accent">Add product →</Link> : undefined}
        />
      ) : (
        <>
          {writable ? (
            <div className="mb-3">
              <ProductBulkBar formId="bulk-products" />
            </div>
          ) : null}
          <form id="bulk-products">
            {/* Phones: one card per product, the facts sellers check first (photo, name, status, price, stock). */}
            <ul className="space-y-2 md:hidden" aria-label="Products">
              {rows.map((p) => (
                <li key={p.id} className="flex items-stretch gap-2 rounded-xl border border-border bg-surface p-2 shadow-xs">
                  {writable ? (
                    <label className="grid w-9 shrink-0 place-items-center">
                      <input type="checkbox" name="ids[]" value={p.id} aria-label={`Select ${p.title}`} className="size-5" />
                    </label>
                  ) : null}
                  <Link href={`/dashboard/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pr-1">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-border/50">{p.thumbUrl ? <Image src={p.thumbUrl} alt="" fill sizes="64px" className="object-cover" /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
                        <Badge tone={PRODUCT_STATUS_TONE[p.status as keyof typeof PRODUCT_STATUS_TONE] ?? "neutral"}>{PRODUCT_STATUS_LABELS[p.status as keyof typeof PRODUCT_STATUS_LABELS] ?? p.status}</Badge>
                        <span className="font-semibold tabular-nums">{p.minPrice === null ? "—" : p.maxPrice !== null && p.maxPrice !== p.minPrice ? `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}` : formatMoney(p.minPrice)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-muted">
                        {p.stockTotal === null ? "Stock not tracked" : `${p.stockTotal} in stock`}
                        {p.categoryName ? ` · ${p.categoryName}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
            <Table caption="Products">
              <thead>
                <tr>
                  {writable ? <th className={th}><span className="sr-only">Select</span></th> : null}
                  <th className={th}>Product</th>
                  <th className={th}>Status</th>
                  <th className={th}>Type</th>
                  <th className={th}>Price</th>
                  <th className={th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    {writable ? (
                      <td className={td}>
                        <input type="checkbox" name="ids[]" value={p.id} aria-label={`Select ${p.title}`} />
                      </td>
                    ) : null}
                    <td className={td}>
                      <Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded bg-border/50">{p.thumbUrl ? <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" /> : null}</span>
                        <span>
                          {p.title}
                          {p.categoryName ? <span className="block text-xs font-normal text-muted">{p.categoryName}</span> : null}
                        </span>
                      </Link>
                    </td>
                    <td className={td}>
                      <Badge tone={PRODUCT_STATUS_TONE[p.status as keyof typeof PRODUCT_STATUS_TONE] ?? "neutral"}>{PRODUCT_STATUS_LABELS[p.status as keyof typeof PRODUCT_STATUS_LABELS] ?? p.status}</Badge>
                    </td>
                    <td className={td}>{typeLabel(p.productType, catalogue.types)}</td>
                    <td className={`${td} tabular-nums`}>{p.minPrice === null ? "—" : p.maxPrice !== null && p.maxPrice !== p.minPrice ? `${formatMoney(p.minPrice)} – ${formatMoney(p.maxPrice)}` : formatMoney(p.minPrice)}</td>
                    <td className={`${td} tabular-nums`}>{p.stockTotal === null ? "—" : `${p.stockTotal} in ${p.variantCount} variant${p.variantCount === 1 ? "" : "s"}`}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </div>
          </form>
          <Pagination page={f.page} pageSize={PRODUCT_PAGE_SIZE} total={total} basePath="/dashboard/products" params={{ ...params, sort: f.sort }} />
        </>
      )}
    </div>
  );
}
