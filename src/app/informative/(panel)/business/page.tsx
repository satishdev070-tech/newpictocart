import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { BusinessInfoForm, HoursForm, SocialLinksForm } from "@/features/informative/panel/site-forms";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getSite } from "@/features/informative/server/repo";

export const metadata: Metadata = { title: "Business info" };

export default async function InformativeBusinessPage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("settings.write")) redirect("/informative/dashboard");
  const site = await getSite(ctx);
  if (!site) redirect("/informative/dashboard");
  return (
    <>
      <PageHeader title="Business info" description="Name, contact details, address, opening hours and social links." />
      <div className="space-y-6">
        <Card title="Business and contact"><BusinessInfoForm site={site} /></Card>
        <Card title="Opening hours"><HoursForm site={site} /></Card>
        <Card title="Social links"><SocialLinksForm site={site} /></Card>
      </div>
    </>
  );
}
