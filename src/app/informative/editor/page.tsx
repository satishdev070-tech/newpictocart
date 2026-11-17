import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { defaultPageSections } from "@/features/informative/defaults";
import { WebsiteEditor } from "@/features/informative/editor/components/editor";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { findEditorPage, listEditorPages } from "@/features/informative/server/editor-repo";
import { getSite, listServices } from "@/features/informative/server/repo";
import { themeOrDefault } from "@/features/informative/themes/registry";
import { findServiceType } from "@/features/informative/service-types";
import { INFO_CATEGORIES } from "@/features/informative/categories";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";

export const metadata: Metadata = { title: "Website editor" };

/**
 * Full-screen Website editor (outside the (panel) layout, so the panel chrome is hidden). Same
 * guard as the panel: requireInformativeTenant() (flag gate, sign-in, Informative store, tenant from
 * the member's own membership). Editing needs content.write; theme.edit alone opens it read-only.
 */
export default async function InformativeEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireInformativeTenant();
  const canWrite = ctx.permissions.has("content.write");
  const canTheme = ctx.permissions.has("theme.edit");
  if (!canWrite && !canTheme) redirect("/informative/dashboard");
  const { page: ref } = await searchParams;
  const [site, pages, services] = await Promise.all([getSite(ctx), listEditorPages(ctx), listServices(ctx)]);
  if (!site) redirect("/informative/dashboard");
  const page = findEditorPage(pages, typeof ref === "string" ? ref : null);
  if (!page) {
    if (typeof ref === "string" && ref !== "home") redirect("/informative/editor?page=home");
    notFound();
  }
  const theme = themeOrDefault(site.themeId);
  // Home renders the design's default sections until it has its own (same rule as the live site).
  const initialSections = page.sections.length || page.type !== "HOME" ? page.sections : defaultPageSections(theme, "HOME");
  const c = theme.tokens.colors;
  // "Dentist / Dental clinic" → "Dental clinic": the Unsplash picker starts from the site's own trade.
  const tradeLabel = findServiceType(site.serviceType)?.label ?? INFO_CATEGORIES.find((x) => x.id === site.category)?.label ?? "";
  const photoTrade = tradeLabel.split("/").pop()?.trim() ?? "";
  return (
    <WebsiteEditor
      key={page.id}
      page={{ id: page.id, type: page.type, title: page.title, updatedAt: page.updatedAt }}
      pages={pages.map((p) => ({ id: p.id, type: p.type, title: p.title, isPublished: p.isPublished }))}
      initialSections={initialSections}
      services={services.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
      canWrite={canWrite}
      canTheme={canTheme}
      canPublish={ctx.permissions.has("theme.publish")}
      status={site.status}
      liveUrl={storeOrigin(storeSubdomain(ctx.tenantSlug))}
      photoTrade={photoTrade}
      theme={{ name: theme.name, colors: [site.primaryColor ?? c.primary, site.secondaryColor ?? c.secondary, c.accent, c.background, c.text] }}
    />
  );
}
