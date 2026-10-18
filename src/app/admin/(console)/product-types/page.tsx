import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { listPlatformProductTypes } from "@/features/catalog/server/product-types";
import { ProductTypesAdmin } from "@/features/catalog/components/product-types-admin";

export const metadata: Metadata = { title: "Product types" };

export default async function ProductTypesPage() {
  const ctx = await requirePlatform("platform.settings.manage");
  const { types, migrated } = await listPlatformProductTypes(ctx);
  return (
    <div className="space-y-4">
      <PageHeader title="Product types" description="The product types sellers pick from in the product form, which industries they're suggested for, and which detail fields each type shows." />
      <ProductTypesAdmin types={types} migrated={migrated} />
    </div>
  );
}
