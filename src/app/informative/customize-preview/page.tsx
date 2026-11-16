import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { informativeFontVariables } from "@/app/informative-fonts";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { customizerPreview, parseCustomizerDraft } from "@/features/informative/server/customizer-preview";
import { getDraftSite } from "@/features/informative/server/public";
import { InformativeSite } from "@/features/informative/site/renderer";
import { buildSiteView } from "@/features/informative/site/view";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Customizer preview", robots: { index: false, follow: false } };

/**
 * Home page shown inside the Customizer's preview iframe (platform host, same origin as the panel).
 * Renders the member's draft with the Customizer's UNSAVED state (`?c=`) laid on top; links inside
 * open the normal saved preview. Nothing is written. theme.edit only.
 */
export default async function InformativeCustomizePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("theme.edit")) notFound();
  const stored = await getDraftSite(ctx.tenantId);
  if (!stored) notFound();
  const { c } = await searchParams;
  const { bundle, theme, sections } = customizerPreview(stored, parseCustomizerDraft(c));
  const link = (p: string) => `/informative/site-preview${p === "/" ? "" : p}`;
  const view = buildSiteView(bundle, {
    asset: assetUrl,
    link,
    preview: true,
    formNote: "Preview: the enquiry form works on your live website.",
    enquiry: { successMessage: bundle.site.options.enquirySuccessMessage, showDateTime: bundle.site.options.showPreferredDateTime === true, privacyHref: link("/privacy") },
  });
  return <InformativeSite theme={theme} view={view} sections={sections} fontClassName={informativeFontVariables} />;
}
