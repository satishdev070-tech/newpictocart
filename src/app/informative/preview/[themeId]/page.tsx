import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { informativeFontVariables } from "@/app/informative-fonts";
import { isInfoCategory } from "@/features/informative/categories";
import { defaultPageSections } from "@/features/informative/defaults";
import { informativeFlagMode, informativeFlagOn } from "@/features/informative/flag";
import type { PageSection } from "@/features/informative/sections";
import { InformativeSite } from "@/features/informative/site/renderer";
import { buildDemoView } from "@/features/informative/site/view";
import { findInformativeTheme } from "@/features/informative/themes/registry";

export const metadata: Metadata = { title: "Theme preview", robots: { index: false, follow: false } };

const PAGES = { home: "HOME", about: "ABOUT", services: "SERVICES", contact: "CONTACT" } as const;
type PreviewPage = keyof typeof PAGES | "gallery";

/**
 * Full-screen live preview of an Informative theme with demo content (onboarding Step 2 and the
 * theme switcher). Public while FEATURE_INFORMATIVE_WEBSITE is on, 404 otherwise. Nothing is read
 * from or written to any store: `name` and `category` only personalise the demo.
 */
export default async function InformativeThemePreview({ params, searchParams }: PageProps<"/informative/preview/[themeId]">) {
  if (!informativeFlagOn(informativeFlagMode())) notFound();
  const { themeId } = await params;
  const theme = findInformativeTheme(themeId);
  if (!theme) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const name = one(sp.name)?.trim().slice(0, 80) || null;
  const cat = one(sp.category);
  const category = isInfoCategory(cat) ? cat : null;
  const pageParam = one(sp.page);
  const page: PreviewPage = pageParam === "gallery" || (pageParam && pageParam in PAGES) ? (pageParam as PreviewPage) : "home";

  const base = `/informative/preview/${theme.id}`;
  const keep = new URLSearchParams();
  if (name) keep.set("name", name);
  if (category) keep.set("category", category);
  const link = (path: string) => {
    const q = new URLSearchParams(keep);
    const slug = path.split("/")[1] ?? "";
    // Service detail pages arrive in M6; in the preview they open the services page.
    const target = slug === "" ? null : slug in PAGES || slug === "gallery" ? slug : null;
    if (target) q.set("page", target);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const view = buildDemoView(theme, { businessName: name, category, link });
  let sections: PageSection[];
  let pageTitle: string | null = null;
  if (page === "gallery") {
    sections = [{ id: "gallery-0", type: "gallery", props: {}, order: 0, visible: true }];
    pageTitle = "Gallery";
  } else {
    sections = defaultPageSections(theme, PAGES[page]);
    pageTitle = page === "home" ? null : page.charAt(0).toUpperCase() + page.slice(1);
  }
  return <InformativeSite theme={theme} view={view} sections={sections} pageTitle={pageTitle} fontClassName={informativeFontVariables} />;
}
