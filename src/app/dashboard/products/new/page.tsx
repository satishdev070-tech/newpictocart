import type { Metadata } from "next";
import Link from "next/link";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { PageHeader } from "@/components/ui/layout";
import { emptyProductDraft } from "@/features/catalog/types";
import { defaultTypeForIndustry } from "@/features/catalog/product-types";
import { ProductEditor } from "@/features/catalog/components/product-editor";
import { productEditorOptions } from "../editor-data";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const ctx = await requireTenantPermission("catalog.write");
  const { t } = await getI18n();
  const opts = await productEditorOptions(ctx.tenantId);
  return (
    <div>
      <PageHeader title={t("pages.products.addTitle")} back={<Link href="/dashboard/products" className="text-muted hover:text-foreground">{t("pages.products.back")}</Link>} />
      <ProductEditor initial={emptyProductDraft(defaultTypeForIndustry(opts.industry, opts.types))} {...opts} initialCollectionIds={[]} canWriteInventory={can(ctx, "inventory.write")} stock={{}} />
    </div>
  );
}
