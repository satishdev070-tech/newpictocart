import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatform } from "@/lib/platform/access";
import { Card, PageHeader } from "@/components/ui/layout";
import { INDUSTRIES } from "@/features/stores/industries";
import { configuredProviders } from "@/features/neural-pulse/server/generate";
import { PROVIDER_LABELS } from "@/features/neural-pulse/schemas";
import { THEME_AI_LIMITS, SCREENSHOT_LIMITS } from "@/features/theme/builder/server/generate";
import { CreateThemeForm } from "@/features/theme/builder/components/create-theme-form";

export const metadata: Metadata = { title: "Create theme" };

export default async function NewThemePage() {
  await requirePlatform("platform.settings.manage");
  const providers = await configuredProviders();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create theme from a reference"
        description="Give a website address and/or screenshots. The AI recreates the look (colours, fonts, header, section layout) with Pictocart's sections, fills every image slot with Unsplash photos and saves a draft you can tweak and publish."
        back={<Link href="/admin/themes">← Themes</Link>}
      />
      {providers.length ? (
        <Card>
          <CreateThemeForm industries={INDUSTRIES.map((i) => ({ value: i.slug, label: i.name }))} limits={{ perHour: THEME_AI_LIMITS.perHour, screenshots: SCREENSHOT_LIMITS.count }} />
          <p className="mt-4 text-caption text-muted">AI provider: {providers.map((p) => PROVIDER_LABELS[p]).join(" → ")} (screenshots go to a vision model first).</p>
        </Card>
      ) : (
        <Card>
          <p className="text-small">
            No AI provider is set up. Add an Anthropic, Gemini or Groq key in <Link href="/admin/social-apps" className="underline">Social apps</Link> first.
          </p>
        </Card>
      )}
    </div>
  );
}
