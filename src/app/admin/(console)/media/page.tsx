import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { AdminUnsplashLibrary } from "@/features/media/components/admin-unsplash";
import { UnsplashKeyCard } from "@/features/media/components/unsplash-key-card";
import { getAppCredentialStatus } from "@/features/platform-apps/server";

export const metadata: Metadata = { title: "Media library" };

/** Platform media: the Unsplash photos the marketing site uses, and Unsplash search. */
export default async function AdminMediaPage() {
  const ctx = await requirePlatform("platform.settings.manage");
  const key = await getAppCredentialStatus(ctx, "unsplash");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Media library"
        description="Unsplash photos used by the theme and category cards on the marketing site, plus search across Unsplash. Copy a photo's URL into any image field in the Landing page editor and show its credit."
      />
      <UnsplashKeyCard status={{ configured: key.configured, source: key.source, secretHint: key.secretHint, savedInDb: key.savedInDb }} />
      <AdminUnsplashLibrary />
    </div>
  );
}
