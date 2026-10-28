import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { getBuilderData } from "@/features/theme/site-builder/server/data";

export const metadata: Metadata = { title: "Theme editor" };

const SiteBuilder = dynamic(() => import("@/features/theme/site-builder/components/site-builder").then((m) => m.SiteBuilder), {
  loading: () => <div className="fixed inset-0 animate-pulse bg-surface-secondary" aria-busy="true" />,
});

export default async function ThemePage() {
  const ctx = await requireTenantPermission("theme.edit");
  const data = await getBuilderData(ctx);
  return <SiteBuilder data={data} />;
}
