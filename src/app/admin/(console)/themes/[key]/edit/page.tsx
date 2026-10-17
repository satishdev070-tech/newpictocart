import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { findMarketplaceTheme } from "@/features/theme/marketplace/catalog";
import { getCustomTheme } from "@/features/theme/builder/server/store";
import { ThemeBuilderEditor } from "@/features/theme/builder/components/theme-builder-editor";

export const metadata: Metadata = { title: "Edit theme" };

export default async function EditThemePage({ params, searchParams }: PageProps<"/admin/themes/[key]/edit">) {
  await requirePlatform("platform.settings.manage");
  const { key } = await params;
  // Built-in themes live in code: open their page, where "Duplicate & edit" makes an editable copy.
  if (findMarketplaceTheme(key)) redirect(`/admin/themes/${key}`);
  const stored = await getCustomTheme(key);
  if (!stored) notFound();
  const created = (await searchParams).created === "1";
  const repairs = stored.theme.generation?.repairs ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${stored.theme.name}`} description="Tweak the design and the home-page layout, then save as a draft or publish it to the marketplace." back={<Link href={`/admin/themes/${key}`}>← Theme preview</Link>} />
      {created ? (
        <div role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-small">
          Theme created as a draft{stored.theme.reference.host ? ` from the look of ${stored.theme.reference.host}` : ""}. It recreates the visual style only; no logo, text or images from the reference were used.
          {repairs.length ? ` ${repairs.length} AI value(s) were corrected automatically.` : ""}
        </div>
      ) : null}
      <ThemeBuilderEditor initial={stored.theme} published={stored.published} />
    </div>
  );
}
