import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { INDUSTRIES, industryShort } from "@/features/stores/industries";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { listCustomThemes } from "@/features/theme/builder/server/store";
import { AdminThemesGrid, type AdminThemeCard } from "@/features/theme/builder/components/admin-themes";

export const metadata: Metadata = { title: "Themes" };

/** Theme marketplace manager: built-in (code) themes plus custom themes (drafts included). */
export default async function AdminThemesPage() {
  await requirePlatform("platform.settings.manage");
  const custom = await listCustomThemes();
  const cards: AdminThemeCard[] = [
    ...custom.map((c) => ({ key: c.theme.key, name: c.theme.name, tagline: c.theme.tagline, industry: c.theme.industry, industryLabel: industryShort(c.theme.industry), style: c.theme.style, preset: c.theme.preset as AdminThemeCard["preset"], source: c.source, published: c.published, updatedAt: c.updatedAt })),
    ...MARKETPLACE_THEMES.map((t) => ({ key: t.key, name: t.name, tagline: t.tagline, industry: t.industry, industryLabel: industryShort(t.industry), style: t.style, preset: t.preset, source: "builtin" as const, published: true, updatedAt: null })),
  ];
  const counts = new Map<string, number>();
  for (const t of cards) counts.set(t.industry, (counts.get(t.industry) ?? 0) + 1);
  const industries = INDUSTRIES.filter((i) => counts.has(i.slug)).map((i) => ({ slug: i.slug, label: i.short, count: counts.get(i.slug)! }));
  const published = custom.filter((c) => c.published).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Themes"
        description={`${MARKETPLACE_THEMES.length} built-in themes and ${custom.length} custom (${published} published). Published custom themes appear in every seller's theme marketplace; drafts are visible to platform staff only.`}
        actions={
          <Link href="/admin/themes/new" className={buttonClass({ size: "md" })}>
            <Sparkles aria-hidden /> Create new theme
          </Link>
        }
      />
      <AdminThemesGrid themes={cards} industries={industries} />
    </div>
  );
}
