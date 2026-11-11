import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { SeoForm } from "@/features/informative/panel/site-forms";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getSite } from "@/features/informative/server/repo";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "SEO" };

export default async function InformativeSeoPage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("settings.write")) redirect("/informative/dashboard");
  const site = await getSite(ctx);
  if (!site) redirect("/informative/dashboard");
  return (
    <>
      <PageHeader title="SEO" description="How your website appears in Google and when shared. Each service and page has its own SEO fields too." />
      <Card><SeoForm site={site} ogUrl={assetUrl(site.seo.ogImagePath)} /></Card>
    </>
  );
}
