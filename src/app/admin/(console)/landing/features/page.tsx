import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { loadFeaturePagesForAdmin } from "@/features/marketing-site/server/feature-pages";
import { DEFAULT_FEATURE_PAGES } from "@/features/marketing-site/feature-pages";
import { FeaturePagesEditor } from "@/features/platform/components/feature-pages-editor";
import { PageHeader } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Feature pages" };

/** CMS for the 28 public `/features/{slug}` marketing pages. */
export default async function FeaturePagesAdmin() {
  await requirePlatform("platform.settings.manage");
  const { content, stored } = await loadFeaturePagesForAdmin();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Feature pages"
        description={
          stored
            ? "Edit titles, copy and infographics for every Features mega-menu page. Changes go live when you select Save & publish."
            : "Showing built-in English defaults for all 28 feature pages. Edit and Save & publish to store your copy in CMS."
        }
      />
      <p className="text-small text-muted">
        Related:{" "}
        <Link href="/admin/landing" className="font-medium text-accent hover:underline">
          Landing page CMS
        </Link>
      </p>
      <FeaturePagesEditor initial={content} defaults={DEFAULT_FEATURE_PAGES} />
    </div>
  );
}
