import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { loadLandingForAdmin } from "@/features/marketing-site/server/landing";
import { DEFAULT_LANDING } from "@/features/marketing-site/landing";
import { LandingEditor } from "@/features/platform/components/landing-editor";
import { PageHeader } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Landing page" };

/** CMS for the public home page, header menu and footer. */
export default async function LandingPageAdmin() {
  await requirePlatform("platform.settings.manage");
  const { content, stored } = await loadLandingForAdmin();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Landing page"
        description={
          stored
            ? "Edit every section of the public home page, the header menu and the footer. Changes go live when you select Save & publish, and every save is audited."
            : "The home page is showing the built-in content. Edit any section and select Save & publish to make it yours. Every save is audited."
        }
      />
      <LandingEditor initial={content} defaults={DEFAULT_LANDING} />
    </div>
  );
}
