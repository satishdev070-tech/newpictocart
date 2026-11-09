import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildMarketingMetadata } from "@/features/marketing-site/seo";
import { siteOrigin } from "@/features/marketing-site/site";
import { filterThemes, parseThemeQuery, themeIndustries, themesHref } from "@/features/marketing-site/themes";
import { ThemeCard } from "@/features/marketing-site/components/theme-card";
import { ButtonLink, Container } from "@/features/marketing-site/components/ui";
import { ecommerceMarketplaceThemes } from "@/features/theme/marketplace/catalog";
import { themeCardImage } from "@/features/theme/layouts/imagery";
import { industryName } from "@/features/stores/industries";

export async function generateMetadata({ searchParams }: PageProps<"/themes">): Promise<Metadata> {
  const q = parseThemeQuery(await searchParams);
  const catalog = ecommerceMarketplaceThemes();
  const meta = buildMarketingMetadata({
    title: q.industry ? `${industryName(q.industry)} themes` : "Themes",
    description: `Browse ${catalog.length} store themes for fashion, jewellery, beauty, home, food, electronics and more. Preview each on a demo store, then use it for yours.`,
    path: q.industry ? `/themes?industry=${q.industry}` : "/themes",
    origin: siteOrigin(),
  });
  // Search result pages are useful to visitors but thin for search engines.
  return q.q || q.page > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ThemesPage({ searchParams }: PageProps<"/themes">) {
  const query = parseThemeQuery(await searchParams);
  const catalog = ecommerceMarketplaceThemes();
  const industries = themeIndustries(catalog, query.siteType);
  const result = filterThemes(query, catalog);
  // Per-theme hero (rotated stock), shown when the theme has no captured screenshot.
  const images = new Map(result.items.map((t) => [t.key, themeCardImage(t)] as const));

  return (
    <>
      <section className="bg-gradient-to-b from-mk-bg to-mk-elev-1 pt-14 pb-8 sm:pt-20" aria-labelledby="themes-title">
        <Container>
          <div className="max-w-2xl">
            <p className="mk-label text-mk-accent">Theme marketplace</p>
            <h1 id="themes-title" className="mk-display-lg mt-4 text-balance text-mk-text">
              Find a theme for your store
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-mk-muted">
              {catalog.length} themes across {industries.length} business categories. Preview any theme on a demo store; previews never change a real store.
            </p>
          </div>
          <form role="search" action="/themes" method="get" className="mt-8 flex max-w-xl gap-2">
            {query.industry ? <input type="hidden" name="industry" value={query.industry} /> : null}
            {query.siteType ? <input type="hidden" name="type" value={query.siteType} /> : null}
            <label htmlFor="theme-search" className="sr-only">
              Search themes
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mk-dim" />
              <input
                id="theme-search"
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder="Search by name, style or product type"
                className="h-12 w-full rounded-full border border-mk-line bg-mk-elev-2 pl-11 pr-4 text-[0.95rem] text-mk-text placeholder:text-mk-dim focus:border-mk-accent focus:outline-2 focus:outline-mk-accent/30"
              />
            </div>
            <button
              type="submit"
              className="h-12 rounded-full bg-mk-accent px-6 text-sm font-semibold text-mk-accent-ink hover:bg-mk-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent"
            >
              Search
            </button>
          </form>
        </Container>
      </section>

      <Container className="pb-20">
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="rounded-mk-md border border-mk-line bg-mk-elev-1 p-4 lg:sticky lg:top-24 lg:self-start lg:border-0 lg:bg-transparent lg:p-0">
            <nav aria-label="Website type">
              <p className="mk-label text-mk-dim">Website type</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                {[
                  { value: "", label: "All templates", count: catalog.length },
                  { value: "ecommerce", label: "Online store", count: catalog.length },
                ].map((type) => (
                  <li key={type.value || "all"}>
                    <Link href={themesHref({ q: query.q, siteType: type.value as typeof query.siteType })} aria-current={query.siteType === type.value ? "page" : undefined} className={sidebarLink(query.siteType === type.value)}>
                      <span>{type.label}</span>
                      <span className="text-xs opacity-65">{type.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Theme categories" className="mt-6 border-t border-mk-line pt-6">
              <p className="mk-label text-mk-dim">Business category</p>
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                <li>
                  <Link href={themesHref({ q: query.q, siteType: query.siteType })} aria-current={!query.industry ? "page" : undefined} className={sidebarLink(!query.industry)}>
                    <span>All categories</span>
                    <span className="text-xs opacity-65">{catalog.length}</span>
                  </Link>
                </li>
                {industries.map((i) => (
                  <li key={i.slug}>
                    <Link href={themesHref({ q: query.q, industry: i.slug, siteType: query.siteType })} aria-current={query.industry === i.slug ? "page" : undefined} className={sidebarLink(query.industry === i.slug)}>
                      <span>{i.label}</span>
                      <span className="text-xs opacity-65">{i.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div>
            <p className="text-sm text-mk-muted" role="status">
              {result.total === 0 ? "No themes found" : `${result.total} ${result.total === 1 ? "theme" : "themes"}`}
              {query.q ? ` for “${query.q}”` : ""}
              {query.industry ? ` in ${industryName(query.industry)}` : ""}
            </p>

            {result.total === 0 ? (
              <div className="mt-8 rounded-mk-lg border border-dashed border-mk-line-strong bg-mk-elev-1 px-6 py-14 text-center">
                <p className="font-brand text-lg font-bold text-mk-text">No themes match your search</p>
                <p className="mt-2 text-sm text-mk-muted">Try a different word, or browse every category.</p>
                <ButtonLink href="/themes" variant="secondary" className="mt-6">
                  Clear filters
                </ButtonLink>
              </div>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((t) => (
                  <li key={t.key} className="h-full">
                    <ThemeCard theme={t} image={images.get(t.key) ?? null} headingLevel="h2" location="themes_page" />
                  </li>
                ))}
              </ul>
            )}

            {result.pages > 1 ? (
              <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
                {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={themesHref({ ...query, page: p })}
                    aria-current={p === result.page ? "page" : undefined}
                    className={cn(
                      "grid size-10 place-items-center rounded-full text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
                      p === result.page ? "bg-mk-accent text-mk-accent-ink" : "border border-mk-line text-mk-text hover:border-mk-accent hover:text-mk-accent",
                    )}
                  >
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
    "flex min-h-9 items-center justify-between gap-4 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
    active ? "bg-mk-accent text-mk-accent-ink" : "text-mk-text hover:bg-mk-elev-2 hover:text-mk-accent",
  );
}
