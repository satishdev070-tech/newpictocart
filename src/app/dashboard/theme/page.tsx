import type { Metadata } from "next";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { getBuilderData } from "@/features/theme/site-builder/server/data";
import { SiteBuilder } from "@/features/theme/site-builder/components/site-builder";

export const metadata: Metadata = { title: "Theme editor" };

export default async function ThemePage() {
  const ctx = await requireTenantPermission("theme.edit");
  const data = await getBuilderData(ctx);
  return <SiteBuilder data={data} />;
}
