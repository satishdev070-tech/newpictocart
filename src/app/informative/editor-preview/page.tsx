import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { informativeFontVariables } from "@/app/informative-fonts";
import { defaultPageSections } from "@/features/informative/defaults";
import { EditorPreview } from "@/features/informative/editor/components/preview-client";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { findEditorPage, listEditorPages } from "@/features/informative/server/editor-repo";
import { getDraftSite } from "@/features/informative/server/public";
import { buildSiteView } from "@/features/informative/site/view";
import { themeOrDefault } from "@/features/informative/themes/registry";
import { assetUrl } from "@/lib/storage/assets";

export const metadata: Metadata = { title: "Editor preview", robots: { index: false, follow: false } };

/**
 * Preview inside the Website editor's iframe (platform host, same origin as the editor). Renders
 * the member's draft site with the page's SAVED sections first; the editor then sends its unsaved
 * sections over postMessage and the page re-renders in the browser. Nothing is written.
 * theme.edit or content.write only.
 */
export default async function InformativeEditorPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireInformativeTenant();
  if (!ctx.permissions.has("content.write") && !ctx.permissions.has("theme.edit")) notFound();
  const { page: ref } = await searchParams;
  const [bundle, pages] = await Promise.all([getDraftSite(ctx.tenantId), listEditorPages(ctx)]);
  const page = findEditorPage(pages, typeof ref === "string" ? ref : null);
  if (!bundle || !page) notFound();
  const theme = themeOrDefault(bundle.site.themeId);
  const sections = page.sections.length || page.type !== "HOME" ? page.sections : defaultPageSections(theme, "HOME");
  const link = (p: string) => `/informative/site-preview${p === "/" ? "" : p}`;
  const view = buildSiteView(bundle, {
    asset: assetUrl,
    link,
    preview: true,
    formNote: "Preview: the enquiry form works on your live website.",
    enquiry: { successMessage: bundle.site.options.enquirySuccessMessage, showDateTime: bundle.site.options.showPreferredDateTime === true, privacyHref: link("/privacy") },
  });
  return <EditorPreview theme={theme} view={view} initialSections={sections} pageTitle={page.type === "HOME" ? null : page.title} fontClassName={informativeFontVariables} />;
}
