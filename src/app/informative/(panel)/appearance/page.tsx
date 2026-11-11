import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/layout";
import { AppearanceForm } from "@/features/informative/panel/site-forms";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { getSite } from "@/features/informative/server/repo";
import { INFORMATIVE_THEMES } from "@/features/informative/themes/registry";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Appearance" };

export default async function InformativeAppearancePage() {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("theme.edit")) redirect("/informative/dashboard");
  const site = await getSite(ctx);
  if (!site) redirect("/informative/dashboard");
  return (
    <>
      <PageHeader title="Appearance" description="Switch design any time: your services, pages and photos stay as they are." />
      <Card>
        <AppearanceForm
          site={site}
          previewName={site.businessName}
          themes={INFORMATIVE_THEMES.map((t) => ({ id: t.id, name: t.name, bestFor: t.bestFor }))}
          images={{ logo: assetUrl(site.logoPath), favicon: assetUrl(site.faviconPath), hero: assetUrl(site.heroImagePath) }}
        />
      </Card>
    </>
  );
}
