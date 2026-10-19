import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { filterThemes, parseThemeQuery, themeIndustries, themesHref } from "@/features/marketing-site/themes";
import { getCategoryImages } from "@/lib/unsplash";
import { ThemeCard } from "@/features/marketing-site/components/theme-card";
import { ButtonLink, Container } from "@/features/marketing-site/components/ui";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";
import { themeSiteType } from "@/features/theme/marketplace/types";
import { industryName } from "@/features/stores/industries";

export async function generateMetadata({ searchParams }: PageProps<"/themes">): Promise<Metadata> {
  const q = parseThemeQuery(await searchParams);
  const meta = buildMarketingMetadata({
    title: q.industry ? `${industryName(q.industry)} themes` : "Themes",
    description: `Browse ${MARKETPLACE_THEMES.length} store themes for fashion, jewellery, beauty, home, food, electronics and more. Preview each on a demo store, then use it for yours.`,
    path: q.industry ? `/themes?industry=${q.industry}` : "/themes",
    origin: siteOrigin(),
  });
  // Search result pages are useful to visitors but thin for search engines.
  return q.q || q.page > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ThemesPage({ searchParams }: PageProps<"/themes">) {
  const query = parseThemeQuery(await searchParams);
  const industries = themeIndustries(MARKETPLACE_THEMES, query.siteType);
  const result = filterThemes(query);
  // Category photo per card, shown when the theme has no captured screenshot.
  const images = await getCategoryImages(result.items.map((t) => t.industry));

  return (
    <>
      <section className="bg-gradient-to-b from-brand-soft/70 to-white pt-14 pb-8 sm:pt-20" aria-labelledby="themes-title">
        <Container>
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Theme marketplace</p>
            <h1 id="themes-title" className="mt-3 font-brand text-4xl font-extrabold tracking-tight text-brand-ink sm:text-5xl">
              Find a theme for your store
            </h1>
            <p className="mt-4 text-lg text-muted">
              {MARKETPLACE_THEMES.length} themes across {industries.length} business categories. Preview any theme on a demo store; previews never change a real store.
            </p>
          </div>
          <form role="search" action="/themes" method="get" className="mt-8 flex max-w-xl gap-2">
            {query.industry ? <input type="hidden" name="industry" value={query.industry} /> : null}
            {query.siteType ? <input type="hidden" name="type" value={query.siteType} /> : null}
            <label htmlFor="theme-search" className="sr-only">
              Search themes
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                id="theme-search"
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder="Search by name, style or product type"
                className="h-12 w-full rounded-full border border-border-strong bg-white pl-11 pr-4 text-[0.95rem] text-brand-ink placeholder:text-subtle focus:border-brand focus:outline-2 focus:outline-brand/30"
              />
            </div>
            <button type="submit" className="h-12 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              Search
            </button>
          </form>
        </Container>
      </section>

      <Container className="pb-20">
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Website type">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Website type</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                {[
                  { value: "", label: "All templates", count: MARKETPLACE_THEMES.length },
                  { value: "informative", label: "Informative website", count: MARKETPLACE_THEMES.filter((t) => themeSiteType(t) === "informative").length },
                  { value: "ecommerce", label: "Online store", count: MARKETPLACE_THEMES.filter((t) => themeSiteType(t) === "ecommerce").length },
                ].map((type) => (
                  <li key={type.value || "all"}>
                    <Link href={themesHref({ q: query.q, siteType: type.value as typeof query.siteType })} aria-current={query.siteType === type.value ? "page" : undefined} className={sidebarLink(query.siteType === type.value)}>
                      <span>{type.label}</span><span className="text-xs opacity-65">{type.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Theme categories" className="mt-6 border-t border-border pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Business category</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                <li>
                  <Link href={themesHref({ q: query.q, siteType: query.siteType })} aria-current={!query.industry ? "page" : undefined} className={sidebarLink(!query.industry)}>
                    <span>All categories</span><span className="text-xs opacity-65">{query.siteType ? MARKETPLACE_THEMES.filter((t) => themeSiteType(t) === query.siteType).length : MARKETPLACE_THEMES.length}</span>
                  </Link>
                </li>
                {industries.map((i) => (
                  <li key={i.slug}>
                    <Link href={themesHref({ q: query.q, industry: i.slug, siteType: query.siteType })} aria-current={query.industry === i.slug ? "page" : undefined} className={sidebarLink(query.industry === i.slug)}>
                      <span>{i.label}</span><span className="text-xs opacity-65">{i.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div>
        <p className="text-sm text-muted" role="status">
          {result.total === 0 ? "No themes found" : `${result.total} ${result.total === 1 ? "theme" : "themes"}`}
          {query.q ? ` for “${query.q}”` : ""}
          {query.industry ? ` in ${industryName(query.industry)}` : ""}
        </p>

        {result.total === 0 ? (
          <div className="mt-8 rounded-brand-lg border border-dashed border-border-strong bg-brand-canvas px-6 py-14 text-center">
            <p className="font-brand text-lg font-bold text-brand-ink">No themes match your search</p>
            <p className="mt-2 text-sm text-muted">Try a different word, or browse every category.</p>
            <ButtonLink href="/themes" variant="secondary" className="mt-6">
              Clear filters
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((t) => (
              <li key={t.key} className="h-full">
                <ThemeCard theme={t} image={images.get(t.industry) ?? null} headingLevel="h2" location="themes_page" />
              </li>
            ))}
          </ul>
        )}

        {result.pages > 1 ? (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
            {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={themesHref({ ...query, page: p })} aria-current={p === result.page ? "page" : undefined} className={cn("grid size-10 place-items-center rounded-full text-sm font-semibold", p === result.page ? "bg-brand text-white" : "border border-border text-brand-ink hover:border-brand")}>
                <span className="sr-only">Page </span>
                {p}
              </Link>
            ))}
          </nav>
        ) : null}
          </div>
        </div>
      </Container>
    </>
  );
}

function sidebarLink(active: boolean) {
  return cn(
    "flex min-h-9 items-center justify-between gap-4 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    active ? "bg-brand text-white" : "text-brand-ink hover:bg-brand-soft hover:text-brand",
  );
}
