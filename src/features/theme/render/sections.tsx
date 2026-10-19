import Link from "next/link";
import { useId, type CSSProperties, type ReactNode } from "react";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";
import { isSectionHidden } from "@/features/theme/schema/config";
import { HEX_COLOR_RE, parseVideoUrl } from "@/features/theme/schema/primitives";
import { sectionBoxVars } from "@/features/theme/schema/section-box";
import { readableOn } from "@/features/theme/tokens-style";
import { getAllCategories, getCollections, getProductBySlug, getProductCards, getProductRefs, listProducts, type ListArgs, type ProductCardData } from "@/features/storefront/server/catalog";
import { getBlogPostById, getFaqs, getLatestReviews, getPageById, getReviewSummary } from "@/features/storefront/server/content";
import { GoldStars, ReviewCard, ReviewSummary } from "@/features/storefront/components/review-card";
import { paths } from "@/features/storefront/urls";
import { ProductCard, ProductGrid as Grid, ProductRow } from "@/features/storefront/components/product-card";
import { CardQuickAdd } from "@/features/storefront/components/card-actions";
import { Price } from "@/features/storefront/components/price";
import { StoreArtImage, StoreImage, storeImageSrc } from "@/features/storefront/components/store-image";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { parseIconValue } from "@/lib/icons/names";
import { Stars } from "@/features/storefront/components/price";
import { NewsletterForm } from "@/features/storefront/components/islands";
import { VideoShop as VideoShopPlayer, type VideoShopItem } from "@/features/storefront/components/video-shop";
import { Carousel } from "@/features/storefront/components/carousel";
import { AutoScrollRow } from "@/features/storefront/components/auto-scroll-row";
import { DECOR_ARTWORKS } from "@/features/theme/sections/definitions";
import { assetUrl } from "@/lib/storage/assets";
import { AnnouncementBar, Footer, Header, MegaMenu } from "./chrome";
import { Cta, HeadingText, Intro, ViewAll, headingClass, hp, sourceArgs } from "./parts";
import { HeroVariant, NewsletterVariant, PhotoCredit, ProductGridVariant, StoryVariant, TestimonialsVariant, TileLayout, cardSettings, stockFor } from "./variants";
import { productPlaceholder } from "@/features/storefront/components/product-card";
import type { CardRatio } from "@/features/theme/sections/variants";
import { PAGE_SECTION_RENDERERS } from "./sections-pages";
import type { RenderContext } from "./context";
import { CategoryDesign, FaqDesign, HeroDesign, PromoDesign, SocialProofSection, isCategoryDesign, isHeroDesign, tileSubtitle } from "./designs-a";

type P<T extends SectionType> = { s: SectionSettings<T>; ctx: RenderContext };

async function Products({ ctx, args, layout, columns, cardRatio }: { ctx: RenderContext; args: ListArgs | null; layout: "grid" | "carousel"; columns?: number; cardRatio?: CardRatio }) {
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  if (!cards.length) return <p className="sf-muted text-sm">Products will appear here soon.</p>;
  const settings = cardSettings(ctx.sf.theme.productCard, cardRatio);
  const stock = ctx.stockProducts ? ctx.stock : null;
  if (layout === "grid" && columns === 6) {
    return (
      <ul className="sf-grid-6 grid grid-cols-2 gap-x-4 gap-y-8 @[48rem]:grid-cols-3 @[64rem]:grid-cols-6">
        {cards.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} settings={settings} placeholder={productPlaceholder(stock, p)} />
          </li>
        ))}
      </ul>
    );
  }
  return layout === "carousel" ? <ProductRow products={cards} settings={settings} stock={stock} /> : <Grid products={cards} settings={settings} columns={columns} stock={stock} />;
}

async function Hero({ s, ctx }: P<"Hero">) {
  if (isHeroDesign(s.variant)) return <HeroDesign s={s} ctx={ctx} variant={s.variant} />;
  if (s.variant !== "overlay") return <HeroVariant s={s} ctx={ctx} />;
  const stock = (sl: (typeof s.slides)[number], i: number) => stockFor(ctx, sl.imagePath || sl.mobileImagePath, "hero", i);
  const banner = s.height === "banner";
  const h = s.height === "large" ? "min-h-[78svh]" : s.height === "medium" ? "min-h-[60svh]" : banner ? "" : "min-h-[44svh]";
  // Banner mode: the image keeps its own proportions (never cropped), so text designed into it stays visible.
  // Separate phone images use one <picture> (StoreArtImage): each device downloads only its own file.
  const bannerMedia = (sl: (typeof s.slides)[number], i: number) =>
    sl.mobileImagePath ? (
      <StoreArtImage path={sl.imagePath} mobilePath={sl.mobileImagePath} alt={sl.alt} sizes="100vw" priority={i === 0} natural stock={stock(sl, i)} />
    ) : (
      <StoreImage path={sl.imagePath} alt={sl.alt} sizes="100vw" priority={i === 0} natural stock={stock(sl, i)} />
    );
  const media = (sl: (typeof s.slides)[number], i: number) =>
    banner ? (
      bannerMedia(sl, i)
    ) : sl.mobileImagePath ? (
      <StoreArtImage path={sl.imagePath} mobilePath={sl.mobileImagePath} alt={sl.alt} sizes="100vw" priority={i === 0} stock={stock(sl, i)} />
    ) : (
      <StoreImage path={sl.imagePath} alt={sl.alt} sizes="100vw" priority={i === 0} stock={stock(sl, i)} />
    );
  return (
    <section className={s.counter ? "sf-hero-counter relative" : undefined}>
      <Carousel label="Featured" variant="hero" autoplayMs={s.autoplay * 1000} className={s.counter ? "sf-hero-counter-carousel" : ""}>
        {s.slides.map((sl, i) =>
          // Image-only slide (text designed into the banner): the whole image is the link, no overlay.
          !sl.heading && !sl.eyebrow && !sl.subheading && !sl.ctaLabel ? (
            <div key={i} className={`relative w-full ${h}`}>
              {sl.ctaHref ? (
                <Link href={sl.ctaHref} aria-label={sl.alt || "Open"} className={banner ? "block" : "absolute inset-0"}>
                  {media(sl, i)}
                </Link>
              ) : (
                media(sl, i)
              )}
            </div>
          ) : (
            // Banner mode keeps the image at its natural height: text overlays it from tablet width up and
            // sits below it (in the page's text colour) on phones, where a short banner can't hold it.
            <div key={i} className={banner ? "relative w-full" : `relative flex w-full items-end ${h}`}>
              {banner ? (
                <div className="relative">
                  {media(sl, i)}
                  <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: s.overlay / 100 }} />
                </div>
              ) : (
                <>
                  {media(sl, i)}
                  <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: s.overlay / 100 }} />
                </>
              )}
              <div className={`sf-container ${banner ? "relative py-6 @[48rem]:absolute @[48rem]:inset-x-0 @[48rem]:bottom-0 @[48rem]:py-12" : "relative py-16"} ${sl.align === "center" ? "text-center" : ""} ${sl.textTone === "light" ? (banner ? "@[48rem]:text-white" : "text-white") : ""}`}>
                <div className={`max-w-xl space-y-4 ${sl.align === "center" ? "mx-auto" : ""}`}>
                  {sl.eyebrow ? <p className="sf-eyebrow !text-current opacity-85">{sl.eyebrow}</p> : null}
                  {i === 0 ? <h1 className="sf-heading text-4xl @[64rem]:text-6xl">{sl.heading}{sl.headingAccent ? <em className="sf-hero-accent">{sl.headingAccent}</em> : null}</h1> : <h2 className="sf-heading text-4xl @[64rem]:text-6xl">{sl.heading}{sl.headingAccent ? <em className="sf-hero-accent">{sl.headingAccent}</em> : null}</h2>}
                  {sl.subheading ? <p className="text-lg opacity-90">{sl.subheading}</p> : null}
                  <Cta label={sl.ctaLabel} href={sl.ctaHref} className={sl.textTone === "light" && !banner ? "sf-btn sf-btn-light" : "sf-btn"} />
                </div>
              </div>
              <PhotoCredit img={stock(sl, i)} className="sf-photo-credit-on" />
            </div>
          ),
        )}
      </Carousel>
      {s.counter && (s.footnote || s.scrollLabel) ? (
        <div aria-hidden className="sf-hero-captions">
          <span>{s.footnote}</span>
          <span>{s.scrollLabel}</span>
        </div>
      ) : null}
    </section>
  );
}

function PromoBanner({ s, ctx }: P<"PromoBanner">) {
  if (s.variant !== "tiles") return <PromoDesign s={s} ctx={ctx} variant={s.variant} />;
  const aspect = s.aspect === "wide" ? "aspect-[16/9]" : s.aspect === "banner" ? "aspect-[2/1]" : s.aspect === "square" ? "aspect-square" : "aspect-[3/4]";
  return (
    <section className="sf-container sf-section">
      <ul className={`grid gap-4 ${s.tiles.length > 1 ? "@[48rem]:grid-cols-2" : ""} ${s.tiles.length > 2 ? "@[64rem]:grid-cols-3" : ""}`}>
        {s.tiles.map((t, i) => (
          <li key={i} className={`relative overflow-hidden rounded-[var(--sf-radius-card)] ${aspect}`}>
            <StoreImage path={t.imagePath} alt={t.alt} sizes={s.tiles.length > 1 ? "(min-width: 768px) 50vw, 100vw" : "100vw"} stock={stockFor(ctx, t.imagePath, "tiles", i)} />
            {!t.heading && !t.text && !t.ctaLabel ? (
              // Image-only tile (text designed into the image): link the whole tile, no gradient.
              t.ctaHref ? <Link href={t.ctaHref} aria-label={t.alt || "Open"} className="absolute inset-0" /> : null
            ) : (
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-6 text-white">
              <h2 className="sf-heading text-2xl">{t.heading}</h2>
              {t.text ? <p className="mt-1 text-sm opacity-90">{t.text}</p> : null}
              <div className="mt-3">
                <Cta label={t.ctaLabel} href={t.ctaHref} className="sf-btn sf-btn-light" />
              </div>
            </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Portrait/square tiles fill the row: one column per tile on desktop (up to 6). Literal classes for Tailwind. */
const DESKTOP_COLS: Record<number, string> = {
  1: "@[48rem]:grid-cols-1",
  2: "@[48rem]:grid-cols-2",
  3: "@[48rem]:grid-cols-3",
  4: "@[48rem]:grid-cols-4",
  5: "@[48rem]:grid-cols-3 @[64rem]:grid-cols-5",
  6: "@[48rem]:grid-cols-3 @[64rem]:grid-cols-6",
};

async function CategoryGrid({ s, ctx }: P<"CategoryGrid">) {
  const all = await getAllCategories(ctx.sf.tenant.tenantId);
  const byId = new Map(all.map((c) => [c.id, c]));
  const tiles =
    s.mode === "manual"
      ? s.items.flatMap((it) => {
          const c = byId.get(it.id);
          return c ? [{ href: paths.category(c.slug), label: it.label || c.name, imagePath: it.imagePath || c.imagePath }] : [];
        }).slice(0, s.limit)
      : all.filter((c) => !c.parentId).slice(0, s.limit).map((c) => ({ href: paths.category(c.slug), label: c.name, imagePath: c.imagePath }));
  if (!tiles.length) return null;
  if (isCategoryDesign(s.variant)) {
    // Banner rows show each category's description (only these designs, so older layouts are unchanged).
    const desc = new Map(all.map((c) => [paths.category(c.slug), c.description]));
    const subtitled = s.variant === "cat-banners" ? tiles.map((t) => ({ ...t, subtitle: tileSubtitle(desc.get(t.href)) })) : tiles;
    return <CategoryDesign tiles={subtitled} variant={s.variant} intro={hp(s)} ctx={ctx} />;
  }
  if (s.variant !== "grid") return <TileLayout tiles={tiles} variant={s.variant} intro={hp(s)} ctx={ctx} />;
  if (s.shape === "arch") {
    return (
      <section className="sf-container sf-section">
        <Intro {...hp(s)} />
        <ul className={`sf-arch-grid grid grid-cols-3 gap-x-3 gap-y-5 @[48rem]:gap-x-6 ${DESKTOP_COLS[Math.min(tiles.length, 6)] ?? DESKTOP_COLS[6]}`}>
          {tiles.map((t, i) => (
            <li key={t.href}>
              <Link href={t.href} className="group block text-center">
                <div className="sf-arch relative aspect-[4/5] overflow-hidden">
                  <StoreImage path={t.imagePath} alt="" sizes={`(min-width: 1024px) ${Math.round(100 / Math.min(tiles.length, 6))}vw, 50vw`} className="transition duration-500 group-hover:scale-105" stock={stockFor(ctx, t.imagePath, "tiles", i)} />
                </div>
                <p className="sf-heading mt-2 text-base leading-tight @[48rem]:mt-3 @[48rem]:text-lg">{t.label}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  const aspect = s.shape === "circle" ? "aspect-square rounded-full" : s.shape === "square" ? "aspect-square" : "aspect-[3/4]";
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <ul className={`grid gap-4 ${s.shape === "circle" ? "grid-cols-3 @[48rem]:grid-cols-4 @[64rem]:grid-cols-6" : `grid-cols-2 ${DESKTOP_COLS[Math.min(tiles.length, 6)] ?? DESKTOP_COLS[6]}`}`}>
        {tiles.map((t, i) => (
          <li key={t.href}>
            <Link href={t.href} className="group block text-center">
              <div className={`relative overflow-hidden ${aspect}`}>
                <StoreImage path={t.imagePath} alt="" sizes={s.shape === "circle" ? "(min-width: 1024px) 16vw, 33vw" : `(min-width: 1024px) ${Math.round(100 / Math.min(tiles.length, 6))}vw, 50vw`} className="transition duration-500 group-hover:scale-105" stock={stockFor(ctx, t.imagePath, "tiles", i)} />
              </div>
              <p className="mt-2 text-sm font-medium">{t.label}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function CollectionGrid({ s, ctx }: P<"CollectionGrid">) {
  const ids = s.mode === "manual" ? s.items.map((i) => i.id).filter(Boolean) : undefined;
  const cols = await getCollections(ctx.sf.tenant.tenantId, ids ? { ids } : { limit: s.limit });
  const labels = new Map(s.items.map((i) => [i.id, i]));
  const ordered = (ids ? ids.flatMap((id) => cols.filter((c) => c.id === id)) : cols).slice(0, s.limit);
  if (!ordered.length) return null;
  if (s.layout !== "grid") {
    const tiles = ordered.map((c) => ({ href: paths.collection(c.slug), label: labels.get(c.id)?.label || c.title, imagePath: labels.get(c.id)?.imagePath || c.imagePath, subtitle: labels.get(c.id)?.subtitle || "" }));
    return <TileLayout tiles={tiles} variant={s.layout} intro={hp(s)} ctx={ctx} />;
  }
  if (s.variant === "overlay") {
    return (
      <section className="sf-container sf-section">
        <Intro {...hp(s)} />
        <ul className={`grid grid-cols-2 gap-3 @[48rem]:gap-5 ${s.columns >= 4 ? "@[64rem]:grid-cols-4" : s.columns === 3 ? "@[64rem]:grid-cols-3" : ""}`}>
          {ordered.map((c, i) => {
            const item = labels.get(c.id);
            const sub = item?.subtitle || "";
            return (
              <li key={c.id}>
                <Link href={paths.collection(c.slug)} className="group sf-overlay-tile relative block aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)] @[48rem]:aspect-[15/16]">
                  <StoreImage path={item?.imagePath || c.imagePath} alt="" sizes="(min-width: 1024px) 25vw, 50vw" className="transition duration-700 group-hover:scale-105" stock={stockFor(ctx, item?.imagePath || c.imagePath, "tiles", i)} />
                  <span className="sf-overlay-caption">
                    <span className="sf-heading block text-xl @[64rem]:text-2xl">{item?.label || c.title}</span>
                    {sub ? <span className="mt-1 block text-[0.62rem] font-medium uppercase tracking-[0.08em] @[64rem]:text-xs">{sub}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <ul className={`grid grid-cols-2 gap-4 ${s.columns >= 4 ? "@[64rem]:grid-cols-4" : s.columns === 3 ? "@[64rem]:grid-cols-3" : ""}`}>
        {ordered.map((c, i) => (
          <li key={c.id}>
            <Link href={paths.collection(c.slug)} className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)]">
              <StoreImage path={labels.get(c.id)?.imagePath || c.imagePath} alt="" sizes="(min-width: 1024px) 25vw, 50vw" className="transition duration-500 group-hover:scale-105" stock={stockFor(ctx, labels.get(c.id)?.imagePath || c.imagePath, "tiles", i)} />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
                <span className="sf-heading text-xl">{labels.get(c.id)?.label || c.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ProductCarouselSection({ s, ctx }: P<"ProductCarousel">) {
  if (s.variant === "tilt") return <TiltCarousel s={s} ctx={ctx} />;
  if (s.variant === "rail") return <ProductGridVariant ctx={ctx} args={sourceArgs(s)} variant="rail" intro={{ ...hp(s), action: <ViewAll href={s.viewAllHref} /> }} cardRatio={s.cardRatio} />;
  if (s.variant === "carousel-tiles") return <TileCarousel s={s} ctx={ctx} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <Products ctx={ctx} args={sourceArgs(s)} layout="carousel" cardRatio={s.cardRatio} />
    </section>
  );
}

async function ProductGridSection({ s, ctx }: P<"ProductGrid">) {
  if (s.variant !== "grid") return <ProductGridVariant ctx={ctx} args={sourceArgs(s)} variant={s.variant} intro={{ ...hp(s), action: <ViewAll href={s.viewAllHref} /> }} cardRatio={s.cardRatio} columns={s.columns} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <Products ctx={ctx} args={sourceArgs(s)} layout="grid" columns={s.columns} cardRatio={s.cardRatio} />
    </section>
  );
}

async function Bestseller({ s, ctx }: P<"Bestseller">) {
  const args: ListArgs = { p_sort: "best_selling", p_limit: s.limit, p_offset: 0 };
  if (s.layout !== "carousel" && s.layout !== "grid") return <ProductGridVariant ctx={ctx} args={args} variant={s.layout} intro={{ ...hp(s), action: <ViewAll href={s.viewAllHref} /> }} cardRatio={s.cardRatio} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <Products ctx={ctx} args={args} layout={s.layout === "carousel" ? "carousel" : "grid"} cardRatio={s.cardRatio} />
    </section>
  );
}

async function NewArrivals({ s, ctx }: P<"NewArrivals">) {
  const args: ListArgs = { p_sort: "newest", p_limit: s.limit, p_offset: 0 };
  if (s.layout !== "carousel" && s.layout !== "grid") return <ProductGridVariant ctx={ctx} args={args} variant={s.layout} intro={{ ...hp(s), action: <ViewAll href={s.viewAllHref} /> }} cardRatio={s.cardRatio} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <Products ctx={ctx} args={args} layout={s.layout === "carousel" ? "carousel" : "grid"} cardRatio={s.cardRatio} />
    </section>
  );
}

function SaleBanner({ s }: P<"SaleBanner">) {
  if (s.variant === "sale-split") {
    return (
      <section style={{ background: s.background, color: s.textColor }}>
        <div className="sf-container sf-section grid items-center gap-8 text-center @[48rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @[48rem]:text-left">
          <div>
            {s.eyebrow ? <p className="sf-eyebrow !text-current opacity-80">{s.eyebrow}</p> : null}
            <h2 className={headingClass(s.headingStyle, "sf-heading mt-2 text-4xl @[64rem]:text-6xl")}>
              <HeadingText heading={s.heading} accent={s.headingAccent} />
            </h2>
            {s.subheading ? <p className="mt-3 max-w-xl opacity-90 @[48rem]:text-lg">{s.subheading}</p> : null}
          </div>
          <div className="flex flex-col items-center gap-3 @[48rem]:items-end">
            {s.code ? (
              <p className="text-sm">
                Use code <span className="ml-1 rounded border border-dashed border-current px-3 py-1 font-mono text-base tracking-widest">{s.code}</span>
              </p>
            ) : null}
            {s.endsText ? <p className="text-xs opacity-80">{s.endsText}</p> : null}
            <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-light mt-2" />
          </div>
        </div>
      </section>
    );
  }
  if (s.variant === "sale-ticket") {
    return (
      <section className="sf-container sf-section">
        <div className="sf-sale-ticket mx-auto grid max-w-4xl @[48rem]:grid-cols-[minmax(0,1fr)_auto]" style={{ background: s.background, color: s.textColor }}>
          <div className="space-y-2 px-8 py-8 text-center @[48rem]:px-12 @[48rem]:py-10 @[48rem]:text-left">
            {s.eyebrow ? <p className="sf-eyebrow !text-current opacity-80">{s.eyebrow}</p> : null}
            <h2 className={headingClass(s.headingStyle, "sf-heading text-3xl @[64rem]:text-4xl")}>
              <HeadingText heading={s.heading} accent={s.headingAccent} />
            </h2>
            {s.subheading ? <p className="opacity-90">{s.subheading}</p> : null}
            {s.endsText ? <p className="text-xs opacity-80">{s.endsText}</p> : null}
          </div>
          <div className="sf-sale-ticket-stub flex flex-col items-center justify-center gap-3 px-8 py-8 @[48rem]:px-10">
            {s.code ? (
              <>
                <p className="text-[0.7rem] uppercase tracking-[0.2em] opacity-80">Use code</p>
                <p className="font-mono text-2xl font-semibold tracking-[0.18em] @[64rem]:text-3xl">{s.code}</p>
              </>
            ) : null}
            <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-light" />
          </div>
        </div>
      </section>
    );
  }
  return (
    <section style={{ background: s.background, color: s.textColor }}>
      <div className="sf-container sf-section text-center">
        {s.eyebrow ? <p className="sf-eyebrow !text-current opacity-80">{s.eyebrow}</p> : null}
        <h2 className="sf-heading mt-2 text-4xl @[64rem]:text-5xl">{s.heading}</h2>
        {s.subheading ? <p className="mt-3 opacity-90">{s.subheading}</p> : null}
        {s.code ? (
          <p className="mt-4 text-sm">
            Use code <span className="rounded border border-current px-2 py-0.5 font-mono tracking-widest">{s.code}</span>
          </p>
        ) : null}
        {s.endsText ? <p className="mt-2 text-xs opacity-80">{s.endsText}</p> : null}
        <div className="mt-6">
          <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-light" />
        </div>
      </div>
    </section>
  );
}

async function EditorialImageText({ s, ctx }: P<"EditorialImageText">) {
  let heading = s.heading;
  let body = s.body;
  let href = s.ctaHref;
  let imagePath = s.imagePath;
  if (s.source === "page" && s.pageId) {
    const page = await getPageById(ctx.sf.tenant.tenantId, s.pageId);
    if (page) {
      heading ||= page.title;
      href ||= paths.page(page.slug);
      const firstPara = page.blocks.find((b) => b.type === "paragraph");
      body ||= firstPara && firstPara.type === "paragraph" ? firstPara.text : "";
    }
  } else if (s.source === "blog" && s.blogPostId) {
    const post = await getBlogPostById(ctx.sf.tenant.tenantId, s.blogPostId);
    if (post) {
      heading ||= post.title;
      body ||= post.excerpt ?? "";
      href ||= paths.blogPost(post.slug);
      imagePath ||= post.coverPath ?? "";
    }
  }
  if (s.variant === "fullbleed") return <EditorialFullbleed s={s} ctx={ctx} heading={heading} body={body} href={href} imagePath={imagePath} />;
  if (s.variant === "journal") return <EditorialJournal s={s} heading={heading} body={body} href={href} imagePath={imagePath} />;
  const stock = stockFor(ctx, imagePath, "story", 1);
  if (s.variant === "overlap") {
    return (
      <section className={`sf-tone-${s.tone}`}>
        <div className="sf-container sf-section">
          <div className="relative grid @[64rem]:grid-cols-12 @[64rem]:items-center">
            <div className={`relative aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)] @[48rem]:aspect-[16/10] @[64rem]:col-span-8 @[64rem]:row-start-1 ${s.imagePosition === "right" ? "@[64rem]:col-start-5" : ""}`}>
              <StoreImage path={imagePath} alt={s.alt} sizes="(min-width: 1024px) 66vw, 100vw" stock={stock} />
              <PhotoCredit img={stock} className="sf-photo-credit-on" />
            </div>
            <div className={`sf-overlap-card relative z-10 mx-4 -mt-16 space-y-4 p-7 shadow-xl @[64rem]:col-span-5 @[64rem]:row-start-1 @[64rem]:mx-0 @[64rem]:mt-0 @[64rem]:p-12 ${s.imagePosition === "right" ? "@[64rem]:col-start-1" : "@[64rem]:col-start-8"}`}>
              {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
              {heading ? <h2 className="sf-heading text-3xl @[64rem]:text-4xl">{heading}</h2> : null}
              {s.subheading ? <p className="text-lg">{s.subheading}</p> : null}
              {body ? <p className="sf-muted whitespace-pre-line leading-relaxed">{body}</p> : null}
              <Cta label={s.ctaLabel || (href ? "Read more" : "")} href={href} className="sf-btn sf-btn-outline" />
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className={`sf-container sf-section grid items-center gap-10 @[48rem]:grid-cols-2 ${s.imagePosition === "right" ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)]">
          <StoreImage path={imagePath} alt={s.alt} sizes="(min-width: 768px) 50vw, 100vw" stock={stock} />
          <PhotoCredit img={stock} className="sf-photo-credit-on" />
        </div>
        <div className="space-y-4">
          {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
          {heading ? <h2 className="sf-heading text-3xl @[64rem]:text-5xl">{heading}</h2> : null}
          {s.subheading ? <p className="text-lg">{s.subheading}</p> : null}
          {body ? <p className="sf-muted whitespace-pre-line leading-relaxed">{body}</p> : null}
          <Cta label={s.ctaLabel || (href ? "Read more" : "")} href={href} className="sf-btn sf-btn-outline" />
        </div>
      </div>
    </section>
  );
}

function VideoBanner({ s }: P<"VideoBanner">) {
  if (s.variant !== "video-boxed") return <VideoBannerVariant s={s} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <div className="relative aspect-video overflow-hidden rounded-[var(--sf-radius-card)] bg-black">
        <VideoBannerMedia s={s} />
      </div>
      <div className="mt-6 text-center">
        <Cta label={s.ctaLabel} href={s.ctaHref} />
      </div>
    </section>
  );
}

/** The video (MP4, YouTube/Vimeo embed or the cover image), filling its box. */
function VideoBannerMedia({ s }: { s: SectionSettings<"VideoBanner"> }) {
  const video = s.videoUrl ? parseVideoUrl(s.videoUrl) : null;
  const poster = assetUrl(s.posterPath) ?? undefined;
  return (
    <>
      {video?.provider === "file" && assetUrl(video.path) ? (
        <video src={assetUrl(video.path)!} poster={poster} className="h-full w-full object-cover" playsInline controls={!s.autoplayMuted} autoPlay={s.autoplayMuted} muted={s.autoplayMuted} loop={s.autoplayMuted} />
      ) : video && video.provider !== "file" ? (
        <iframe
          src={`${video.embedUrl}${s.autoplayMuted ? (video.embedUrl.includes("?") ? "&" : "?") + "autoplay=1&mute=1&muted=1&loop=1" : ""}`}
          title={s.heading || "Video"}
          className="h-full w-full"
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- poster fallback
        <img src={poster} alt="" className="h-full w-full object-cover" />
      ) : null}
    </>
  );
}

/** Full-width (text over the video) and split (video beside the text) video banners. */
function VideoBannerVariant({ s }: { s: SectionSettings<"VideoBanner"> }) {
  const text = (light: boolean) => (
    <>
      {s.eyebrow ? <p className={`sf-eyebrow ${light ? "!text-white/90" : ""}`}>{s.eyebrow}</p> : null}
      {s.heading ? (
        <h2 className={headingClass(s.headingStyle, "sf-heading text-3xl @[64rem]:text-5xl")}>
          <HeadingText heading={s.heading} accent={s.headingAccent} />
        </h2>
      ) : null}
      {s.subheading ? <p className={light ? "max-w-xl text-white/90" : "sf-muted max-w-xl leading-relaxed"}>{s.subheading}</p> : null}
    </>
  );
  if (s.variant === "video-fullbleed") {
    return (
      <section className="relative overflow-hidden bg-black text-white">
        <div className="relative aspect-[4/5] w-full @[48rem]:aspect-video @[80rem]:aspect-[21/9]">
          <VideoBannerMedia s={s} />
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
          {/* Clicks pass through the text layer to the player; only the button takes them. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-4 px-6 pb-10 text-center @[64rem]:pb-16">
            {text(true)}
            {s.ctaLabel && s.ctaHref ? (
              <div className="pointer-events-auto pt-2">
                <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-light" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={`sf-container sf-section grid items-center gap-8 @[48rem]:grid-cols-2 @[64rem]:gap-14 ${s.videoPosition === "right" ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
      <div className="relative aspect-video overflow-hidden rounded-[var(--sf-radius-card)] bg-black">
        <VideoBannerMedia s={s} />
      </div>
      <div className="space-y-4">
        {text(false)}
        <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-outline" />
      </div>
    </section>
  );
}

function Lookbook({ s, ctx }: P<"Lookbook">) {
  if (!s.looks.length) return null;
  if (s.layout === "arches") return <LookbookArches s={s} ctx={ctx} />;
  if (s.layout === "lookbook-rail") return <LookbookRail s={s} ctx={ctx} />;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <ul className={s.layout === "masonry" ? "columns-2 gap-4 @[64rem]:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid" : "grid grid-cols-2 gap-4 @[64rem]:grid-cols-3"}>
        {s.looks.map((l, i) => (
          <li key={i}>
            <figure>
              <div className={`relative overflow-hidden rounded-[var(--sf-radius-card)] ${i % 3 === 1 ? "aspect-[3/5]" : "aspect-[3/4]"}`}>
                <StoreImage path={l.imagePath} alt={l.alt} sizes="(min-width: 1024px) 33vw, 50vw" />
              </div>
              {l.caption ? <figcaption className="sf-muted mt-2 text-sm">{l.caption}</figcaption> : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BrandStory({ s, ctx }: P<"BrandStory">) {
  if (s.variant !== "split") return <StoryVariant s={s} ctx={ctx} />;
  const stock = stockFor(ctx, s.imagePath, "story", 0);
  const grid = (
    <section className={`sf-container sf-section grid items-center gap-10 @[48rem]:grid-cols-2 ${s.imagePosition === "left" ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
      <div className="space-y-5">
        {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
        <h2 className="sf-heading text-3xl @[64rem]:text-5xl">{s.heading}</h2>
        {s.subheading ? <p className="text-lg">{s.subheading}</p> : null}
        {s.body ? <p className="sf-muted whitespace-pre-line leading-relaxed">{s.body}</p> : null}
        {s.stats.length ? (
          <dl className="grid grid-cols-2 gap-6 pt-2 @[48rem]:grid-cols-4">
            {s.stats.map((st, i) => (
              <div key={i}>
                <dt className="sf-muted text-xs">{st.label}</dt>
                <dd className="sf-heading text-3xl">{st.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-outline" />
      </div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)]">
        <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 768px) 50vw, 100vw" stock={stock} />
        <PhotoCredit img={stock} className="sf-photo-credit-on" />
      </div>
    </section>
  );
  // "light" keeps the original transparent background.
  return s.tone === "light" ? grid : <div className={`sf-tone-${s.tone}`}>{grid}</div>;
}

function Testimonials({ s, ctx }: P<"Testimonials">) {
  if (!s.items.length) return null;
  if (s.variant !== "grid") return <TestimonialsVariant s={s} ctx={ctx} />;
  return (
    <section className="sf-surface">
      <div className="sf-container sf-section">
        <Intro {...hp(s)} />
        <ul className="grid gap-6 @[48rem]:grid-cols-3">
          {s.items.map((t, i) => (
            <li key={i}>
              <figure className="space-y-3">
                {t.rating ? <Stars rating={t.rating} /> : null}
                <blockquote className="sf-heading text-xl leading-snug">“{t.quote}”</blockquote>
                <figcaption className="sf-muted text-sm">
                  {t.author}
                  {t.location ? `, ${t.location}` : ""}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

async function ReviewsSection({ s, ctx }: P<"Reviews">) {
  if (!ctx.sf.features.reviews) return null;
  const [reviews, summary] = await Promise.all([getLatestReviews(ctx.sf.tenant.tenantId, s.minRating, s.limit), getReviewSummary(ctx.sf.tenant.tenantId)]);
  if (!reviews.length) return null;
  if (s.variant === "reviews-grid") {
    return (
      <section className="sf-section sf-reviews-band">
        <div className="sf-container">
          <Intro {...hp(s)} />
          <ReviewSummary average={summary.average} count={summary.count} className="mb-8 justify-center" />
          <ul className="grid gap-4 @[48rem]:grid-cols-2 @[64rem]:grid-cols-3 @[64rem]:gap-5">
            {reviews.map((r) => (
              <li key={r.id}>
                <ReviewCard review={r} showProduct={s.showProduct} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  if (s.variant === "reviews-split") {
    return (
      <section className="sf-section sf-reviews-band">
        <div className="sf-container grid gap-8 @[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] @[64rem]:gap-12">
          <div className="space-y-5 @[64rem]:sticky @[64rem]:top-24 @[64rem]:self-start">
            {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
            {s.heading ? (
              <h2 className={headingClass(s.headingStyle, "sf-heading text-3xl @[64rem]:text-4xl")}>
                <HeadingText heading={s.heading} accent={s.headingAccent} />
              </h2>
            ) : null}
            {s.subheading ? <p className="sf-muted">{s.subheading}</p> : null}
            {summary.count ? (
              <div className="sf-reviews-score">
                <p className="sf-heading text-6xl leading-none">{summary.average.toFixed(1)}</p>
                <GoldStars rating={summary.average} size={20} />
                <p className="sf-muted text-sm">
                  Based on {summary.count} review{summary.count === 1 ? "" : "s"}
                </p>
              </div>
            ) : null}
          </div>
          <ul className="grid gap-4 @[48rem]:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id}>
                <ReviewCard review={r} showProduct={s.showProduct} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  return (
    <section className="sf-section sf-reviews-band">
      <div className="sf-container">
        <Intro {...hp(s)} />
        <ReviewSummary average={summary.average} count={summary.count} className="mb-8 justify-center" />
        <Carousel label="Customer reviews" itemClassName="w-[84%] @[48rem]:w-[46%] @[64rem]:w-[calc((100%-3.75rem)/4)]">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </Carousel>
      </div>
    </section>
  );
}

/** Instagram / social: every layout and the connected-Instagram feed live in ./designs-a. */
function SocialProof({ s, ctx }: P<"SocialProof">) {
  return <SocialProofSection s={s} ctx={ctx} />;
}

function Newsletter({ s, ctx }: P<"Newsletter">) {
  if (s.variant !== "centered") return <NewsletterVariant s={s} ctx={ctx} />;
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section mx-auto max-w-2xl space-y-4 text-center">
        {s.eyebrow ? <p className="sf-eyebrow">{s.eyebrow}</p> : null}
        <h2 className="sf-heading text-3xl">{s.heading}</h2>
        {s.subheading ? <p className="sf-muted">{s.subheading}</p> : null}
        <NewsletterForm buttonLabel={s.buttonLabel} />
      </div>
    </section>
  );
}

async function FAQ({ s, ctx }: P<"FAQ">) {
  const items = s.source === "manual" ? s.items : (await getFaqs(ctx.sf.tenant.tenantId, { group: s.group || undefined, limit: s.limit })).map((f) => ({ question: f.question, answer: f.answer }));
  if (!items.length) return null;
  if (s.variant !== "accordion") return <FaqDesign s={s} items={items} />;
  return (
    <section className="sf-container sf-section mx-auto max-w-3xl">
      <Intro {...hp(s)} />
      <div className="sf-border divide-y divide-[var(--sf-border)] border-y">
        {items.map((f, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.question}
              <span aria-hidden className="transition group-open:rotate-45">+</span>
            </summary>
            <p className="sf-muted mt-3 whitespace-pre-line text-sm leading-relaxed">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const TRUST_GLYPHS: Record<string, string> = { truck: "🚚", return: "↺", cod: "₹", handmade: "✋", secure: "🔒", india: "🇮🇳", gift: "🎁", leaf: "🌿", sparkle: "✧" };

function TrustBadges({ s }: P<"TrustBadges">) {
  if (s.layout === "cards" || s.layout === "badges") {
    const cards = s.layout === "cards";
    return (
      <section className={`sf-tone-${s.tone}`}>
        <ul className={`sf-container grid grid-cols-2 gap-3 py-10 @[48rem]:gap-5 ${s.items.length >= 4 ? "@[64rem]:grid-cols-4" : "@[64rem]:grid-cols-3"}`}>
          {s.items.map((t, i) => (
            <li key={i} className={cards ? "sf-usp-card flex items-start gap-3 p-5" : "flex flex-col items-center gap-3 text-center"}>
              <span aria-hidden className={cards ? "sf-usp-icon" : "sf-usp-badge"}>
                {TRUST_GLYPHS[t.icon] ?? "✓"}
              </span>
              <span className="space-y-1">
                <span className={`block font-medium ${cards ? "text-sm" : "sf-heading text-lg"}`}>{t.title}</span>
                {t.text ? <span className="sf-muted block text-xs">{t.text}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (s.layout === "line") {
    return (
      <section className={`sf-tone-${s.tone} sf-trust-line`}>
        <ul className="sf-container flex flex-wrap items-center justify-center gap-x-10 gap-y-2 py-5 @[64rem]:justify-around">
          {s.items.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span aria-hidden className="text-xs">
                {TRUST_GLYPHS[t.icon] ?? "✓"}
              </span>
              <span>{t.title}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (s.layout === "marquee") {
    const row = (copy: number) => s.items.map((t, i) => (
      <li key={`${copy}-${i}`} aria-hidden={copy > 0 || undefined} className="flex shrink-0 items-center gap-2 px-8">
        <span aria-hidden className="text-lg">{TRUST_GLYPHS[t.icon] ?? "✓"}</span>
        <span className="text-sm font-medium">{t.title}</span>
        {t.text ? <span className="sf-muted text-xs">{t.text}</span> : null}
      </li>
    ));
    return (
      <section className={`sf-tone-${s.tone} sf-marquee py-4`} style={{ ["--sf-marquee-duration" as string]: `${Math.max(18, s.items.length * 7)}s` }}>
        <ul className="sf-marquee-track">
          {row(0)}
          {/* Second copy for the seamless loop; hidden from assistive tech. */}
          {row(1)}
        </ul>
      </section>
    );
  }
  return (
    <section className={`sf-tone-${s.tone}`}>
      <ul className="sf-container grid grid-cols-2 gap-6 py-10 text-center @[64rem]:grid-cols-4">
        {s.items.map((t, i) => (
          <li key={i} className="space-y-1">
            <span aria-hidden className="text-2xl">
              {TRUST_GLYPHS[t.icon] ?? "✓"}
            </span>
            <p className="text-sm font-medium">{t.title}</p>
            {t.text ? <p className="sf-muted text-xs">{t.text}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const MARQUEE_SIZE = { small: "text-sm py-2", medium: "text-xl py-3", large: "sf-heading text-4xl py-5 @[64rem]:text-6xl" } as const;
const MARQUEE_SPEED = { slow: 9, normal: 6, fast: 3.5 } as const;
const SEPARATOR = { dot: "•", star: "✦", none: "", sparkle: "✧" } as const;

function Marquee({ s }: P<"Marquee">) {
  const sep = SEPARATOR[s.separator];
  // Repeat short lists so one copy is wider than the screen.
  const words = Array.from({ length: Math.max(1, Math.ceil(8 / s.items.length)) }, () => s.items).flat();
  const row = words.map((it, i) => (
    <span key={i} className="flex shrink-0 items-center gap-6 px-3">
      <span>{it.text}</span>
      {sep ? <span aria-hidden className="opacity-60">{sep}</span> : null}
    </span>
  ));
  const duration = { ["--sf-marquee-duration" as string]: `${words.length * MARQUEE_SPEED[s.speed]}s` };
  const lettering = `${MARQUEE_SIZE[s.size]}${s.fontStyle === "italic-serif" ? " sf-marquee-italic" : ""}`;
  const single = (
    <div className={`sf-tone-${s.tone} sf-marquee ${lettering}`} style={duration}>
      <p className="sr-only">{s.items.map((i) => i.text).join(" · ")}</p>
      <div aria-hidden className="sf-marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
  // Two rows: the second scrolls the other way in outlined lettering. Tilted: the strip as a slanted ribbon.
  const strip =
    s.variant === "marquee-double" ? (
      <div className={`sf-tone-${s.tone}`}>
        {single}
        <div aria-hidden className={`sf-marquee sf-marquee-reverse sf-marquee-outline ${lettering}`} style={duration}>
          <div className="sf-marquee-track">
            {row}
            {row}
          </div>
        </div>
      </div>
    ) : s.variant === "marquee-tilted" ? (
      <div className="sf-marquee-tilt">{single}</div>
    ) : (
      single
    );
  return s.link ? (
    <Link href={s.link} className="block">
      {strip}
    </Link>
  ) : (
    strip
  );
}

async function VideoShop({ s, ctx }: P<"VideoShop">) {
  if (!s.items.length) return null;
  const ids = s.items.map((i) => i.productId).filter(Boolean);
  const cards = ids.length ? await getProductCards(ctx.sf.tenant.tenantId, ids) : [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items: VideoShopItem[] = s.items.flatMap((it) => {
    const v = it.videoUrl ? parseVideoUrl(it.videoUrl) : null;
    const src = v?.provider === "file" ? assetUrl(v.path) : null;
    const embed = v && v.provider !== "file" ? v.embedUrl : null;
    const poster = assetUrl(it.posterPath);
    if (!src && !embed && !poster) return [];
    const c = it.productId ? byId.get(it.productId) : undefined;
    return [{ src, embed, poster, title: it.title || c?.title || "", product: c ? { href: paths.product(c.slug), title: c.title, priceMinor: c.priceMinor, compareAtMinor: c.compareAtMinor, image: assetUrl(c.imagePath) } : null }];
  });
  if (!items.length) return null;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <VideoShopPlayer items={items} layout={s.layout} />
    </section>
  );
}

function BrandStrip({ s }: P<"BrandStrip">) {
  const tile = (b: (typeof s.items)[number], key: string, hidden = false) => {
    const logo = assetUrl(b.imagePath);
    const inner = parseIconValue(b.imagePath) ? (
      <span className="flex items-center gap-2 text-[var(--sf-text)]">
        <IconGlyph value={b.imagePath} className="size-7" />
        <span className="sf-brand-word">{b.name}</span>
      </span>
    ) : logo ? (
      // eslint-disable-next-line @next/next/no-img-element -- small logo with intrinsic ratio
      <img src={logo} alt={b.name} className="h-8 w-auto max-w-[9rem] object-contain grayscale transition hover:grayscale-0" loading="lazy" />
    ) : (
      <span className="sf-brand-word">{b.name}</span>
    );
    return (
      <li key={key} aria-hidden={hidden || undefined} className="flex shrink-0 items-center justify-center px-6 @[64rem]:px-9">
        {b.href && !hidden ? (
          <Link href={b.href} className="opacity-75 transition hover:opacity-100">
            {inner}
          </Link>
        ) : (
          <span className="opacity-75">{inner}</span>
        )}
      </li>
    );
  };
  return (
    <section className={`sf-tone-${s.tone} sf-section`}>
      <div className="sf-container">
        <Intro {...hp(s)} />
      </div>
      {s.layout === "marquee" ? (
        <div className="sf-marquee" style={{ ["--sf-marquee-duration" as string]: `${Math.max(20, s.items.length * 5)}s` }}>
          <ul className="sf-marquee-track py-2">
            {s.items.map((b, i) => tile(b, `a${i}`))}
            {s.items.map((b, i) => tile(b, `b${i}`, true))}
          </ul>
        </div>
      ) : s.layout === "brands-grid" ? (
        <div className="sf-container">
          <ul className="sf-brand-grid grid grid-cols-2 @[48rem]:grid-cols-3 @[64rem]:grid-cols-4">{s.items.map((b, i) => tile(b, `g${i}`))}</ul>
        </div>
      ) : (
        <ul className="sf-container flex flex-wrap items-center justify-center gap-y-6">{s.items.map((b, i) => tile(b, `r${i}`))}</ul>
      )}
    </section>
  );
}


// -----------------------------------------------------------------------------
// Editorial looks (opt-in variants and sections; existing defaults render as before)
// -----------------------------------------------------------------------------

/** Tilted image cards: alternating angles, title on the image, arrows with a label below. */
async function TiltCarousel({ s, ctx }: P<"ProductCarousel">) {
  const args = sourceArgs(s);
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  if (!cards.length) return null;
  const tiltCards = cards.map((p) => (
    <Link key={p.id} href={paths.product(p.slug)} className="sf-tilt-card group relative block aspect-[4/5] overflow-hidden" draggable={s.autoScroll ? false : undefined}>
      <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="(min-width: 1024px) 17vw, 62vw" className="transition duration-700 group-hover:scale-105" />
      <span className="sf-tilt-title sf-heading">{p.title}</span>
    </Link>
  ));
  return (
    <section className="sf-section overflow-hidden">
      <div className="sf-container">
        <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      </div>
      <div className="sf-tilt" data-drag-label={s.dragLabel || undefined}>
        {s.autoScroll ? (
          <AutoScrollRow label={s.heading || "Products"} itemClassName="sf-tilt-item w-[62%] @[48rem]:w-[30%] @[64rem]:w-[17%]">
            {tiltCards}
          </AutoScrollRow>
        ) : (
          <Carousel label={s.heading || "Products"} itemClassName="sf-tilt-item w-[62%] @[48rem]:w-[30%] @[64rem]:w-[17%]">
            {tiltCards}
          </Carousel>
        )}
        {s.dragLabel ? <p className="sf-tilt-label">{s.dragLabel}</p> : null}
      </div>
    </section>
  );
}

/** Big photo slides: one large product photo per slide with the name and price on it (ProductCarousel "carousel-tiles"). */
async function TileCarousel({ s, ctx }: P<"ProductCarousel">) {
  const args = sourceArgs(s);
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  if (!cards.length) return null;
  const stock = ctx.stockProducts ? ctx.stock : null;
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <Carousel label={s.heading || "Products"} itemClassName="w-[86%] @[48rem]:w-[48%] @[64rem]:w-[calc((100%-2.5rem)/3)]">
        {cards.map((p) => (
          <Link key={p.id} href={paths.product(p.slug)} className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)]">
            <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 48vw, 86vw" stock={productPlaceholder(stock, p)} className="transition duration-700 group-hover:scale-105" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
              <span className="sf-heading min-w-0 text-2xl leading-tight">{p.title}</span>
              <span className="sf-bigtile-price shrink-0">
                <Price priceMinor={p.priceMinor} compareAtMinor={null} fromPrice={p.hasPriceRange} size="sm" />
              </span>
            </span>
          </Link>
        ))}
      </Carousel>
    </section>
  );
}

/** Add-to-bag control for compact layouts: quick add for one-variant products, otherwise a link to choose options. */
function AddToBag({ p, label, className }: { p: ProductCardData; label: string; className: string }) {
  if (!p.inStock) return <span className={`${className} is-disabled`}>Sold out</span>;
  if (p.singleVariantId) {
    return (
      <div className={className} data-label={label}>
        <CardQuickAdd title={p.title} sizes={[]} singleVariantId={p.singleVariantId} />
      </div>
    );
  }
  return (
    <Link href={paths.product(p.slug)} className={`${className} sf-add-link`}>
      {label}
    </Link>
  );
}

async function CompactProducts({ s, ctx }: P<"CompactProducts">) {
  const args = sourceArgs(s);
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  if (!cards.length) return null;
  const cols = s.columns >= 4 ? "@[64rem]:grid-cols-4" : s.columns === 3 ? "@[64rem]:grid-cols-3" : s.columns === 2 ? "@[64rem]:grid-cols-2" : "";
  if (s.variant === "compact-list") {
    // One product per line; wide screens split the list into up to two columns.
    return (
      <section className="sf-container sf-section sf-compact">
        <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
        <ul className={`sf-compact-list grid gap-x-10 ${s.columns >= 2 ? "@[64rem]:grid-cols-2" : ""}`}>
          {cards.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3 @[48rem]:gap-5">
              <Link href={paths.product(p.slug)} className="relative block aspect-square w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius-card)] bg-[var(--sf-surface)] @[48rem]:w-16">
                <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="64px" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={paths.product(p.slug)} className="sf-heading line-clamp-2 block text-base leading-tight @[48rem]:text-lg">
                  {p.title}
                </Link>
                <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare showPercent={false} size="sm" />
              </div>
              <AddToBag p={p} label={s.buttonLabel || "Add to bag"} className="sf-compact-add shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (s.variant === "compact-rail") {
    return (
      <section className="sf-container sf-section sf-compact">
        <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
        <ul className="sf-scroll-row -mx-4 px-4 @[48rem]:mx-0 @[48rem]:px-0">
          {cards.map((p) => (
            <li key={p.id} className="sf-rail-item sf-compact-card flex w-[78%] shrink-0 items-center gap-3 p-3 @[48rem]:w-[40%] @[64rem]:w-[calc((100%-2.25rem)/4)]">
              <Link href={paths.product(p.slug)} className="relative block aspect-[8/11] w-16 shrink-0 overflow-hidden bg-[var(--sf-surface)]">
                <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="64px" />
              </Link>
              <div className="min-w-0 space-y-1.5">
                <Link href={paths.product(p.slug)} className="sf-heading line-clamp-2 block text-[0.95rem] leading-tight">
                  {p.title}
                </Link>
                <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare showPercent={false} size="sm" />
                <AddToBag p={p} label={s.buttonLabel || "Add to bag"} className="sf-compact-add" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className="sf-container sf-section sf-compact">
      <Intro {...hp(s)} action={<ViewAll href={s.viewAllHref} />} />
      <ul className={`grid grid-cols-2 gap-x-3 gap-y-5 @[48rem]:gap-x-6 ${cols}`}>
        {cards.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5 @[48rem]:gap-4">
            <Link href={paths.product(p.slug)} className="relative block aspect-[8/11] w-12 shrink-0 overflow-hidden bg-[var(--sf-surface)] @[48rem]:w-20">
              <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="80px" />
            </Link>
            <div className="min-w-0 space-y-1.5 pt-2">
              <Link href={paths.product(p.slug)} className="sf-heading line-clamp-2 block text-[0.95rem] leading-tight @[48rem]:truncate @[48rem]:text-lg">
                {p.title}
              </Link>
              <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare showPercent={false} size="sm" />
              <AddToBag p={p} label={s.buttonLabel || "Add to bag"} className="sf-compact-add" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ProductSpotlight({ s, ctx }: P<"ProductSpotlight">) {
  const args = sourceArgs(s);
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  const items = cards.slice(0, 8);
  if (!items.length) return null;
  const details = await Promise.all(items.map((p) => getProductBySlug(ctx.sf.tenant.tenantId, p.slug)));
  const blurbs = details.map((d) => {
    const text = (d?.shortDescription || d?.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 190 ? `${text.slice(0, 187).replace(/\s+\S*$/, "")}…` : text;
  });
  return <SpotlightView s={s} items={items} blurbs={blurbs} />;
}

/** CSS-only switching (radio inputs + labels): no client JS beyond the add-to-bag island. */
function SpotlightView({ s, items, blurbs }: { s: SectionSettings<"ProductSpotlight">; items: ProductCardData[]; blurbs: string[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rid = (i: number) => `spot-${uid}-${(i + items.length) % items.length}`;
  const n = items.length;
  const pad = (i: number) => String(i).padStart(2, "0");
  if (s.variant === "spotlight-rows") {
    // Every product as its own row, photo sides alternating on wide screens; no switching.
    return (
      <section className="sf-container sf-section">
        <Intro {...hp(s)} />
        <ul className="space-y-12 @[64rem]:space-y-16">
          {items.map((p, i) => (
            <li key={p.id} className={`grid items-center gap-6 @[48rem]:grid-cols-2 @[64rem]:gap-14 ${i % 2 ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
              <Link href={paths.product(p.slug)} className="relative block aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)] @[64rem]:aspect-[5/6]" tabIndex={-1} aria-hidden>
                <StoreImage path={p.imagePath} alt="" sizes="(min-width: 768px) 50vw, 100vw" className="transition duration-700 hover:scale-105" />
              </Link>
              <div className="sf-spot-info">
                <p className="sf-eyebrow !text-current">
                  {pad(i + 1)}
                  {s.productEyebrow ? ` · ${s.productEyebrow}` : ""}
                </p>
                <h3 className="sf-heading sf-spot-title">
                  <Link href={paths.product(p.slug)}>{p.title}</Link>
                </h3>
                <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare showPercent={false} />
                {blurbs[i] ? <p className="sf-muted max-w-md text-sm leading-relaxed">{blurbs[i]}</p> : null}
                {s.note ? <p className="sf-muted text-sm">{s.note}</p> : null}
                <AddToBag p={p} label={s.buttonLabel || "Add to bag"} className={`sf-spot-add sf-spot-add-${s.buttonStyle}`} />
                {s.detailsLabel ? (
                  <Link href={paths.product(p.slug)} className="sf-underline-link">
                    {s.detailsLabel}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <div className={`sf-spot${s.variant === "spotlight-reverse" ? " sf-spot-reverse" : ""}`}>
        {items.map((p, i) => (
          <input key={p.id} type="radio" name={`spot-${uid}`} id={rid(i)} defaultChecked={i === 0} className="sf-spot-radio sr-only" aria-label={p.title} />
        ))}
        <div className="sf-spot-body">
          {n > 1 ? (
            <div className="sf-spot-thumbs" aria-hidden>
              {items.map((p, i) => (
                <label key={p.id} htmlFor={rid(i)} className="sf-spot-thumb">
                  <StoreImage path={p.imagePath} alt="" sizes="90px" />
                </label>
              ))}
            </div>
          ) : null}
          {items.map((p, i) => (
            <article key={p.id} className="sf-spot-slide">
              <div className="sf-spot-media">
                {s.tagline ? <p className="sf-spot-tagline sf-heading">{s.tagline}</p> : null}
                <Link href={paths.product(p.slug)} className="sf-spot-image relative block" tabIndex={-1} aria-hidden>
                  <StoreImage path={p.imagePath} alt="" sizes="(min-width: 1024px) 34vw, 90vw" />
                </Link>
                {n > 1 ? (
                  <div className="sf-spot-nav">
                    <label htmlFor={rid(i - 1)} aria-label="Previous">‹</label>
                    <span>
                      {pad(i + 1)} / {pad(n)}
                    </span>
                    <label htmlFor={rid(i + 1)} aria-label="Next">›</label>
                  </div>
                ) : null}
              </div>
              <div className="sf-spot-info">
                {s.productEyebrow ? <p className="sf-eyebrow !text-current">{s.productEyebrow}</p> : null}
                <h3 className="sf-heading sf-spot-title">{p.title}</h3>
                <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare showPercent={false} />
                {blurbs[i] ? <p className="sf-muted max-w-md text-sm leading-relaxed">{blurbs[i]}</p> : null}
                {n > 1 ? (
                  <div className="sf-spot-swatches">
                    {s.swatchLabel ? <p className="sf-eyebrow !text-current">{s.swatchLabel}</p> : null}
                    <div className="flex gap-2">
                      {items.map((q, j) => (
                        <label key={q.id} htmlFor={rid(j)} className={`sf-spot-swatch ${j === i ? "is-active" : ""}`} title={q.title}>
                          <StoreImage path={q.imagePath} alt="" sizes="40px" />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                {s.note ? <p className="sf-muted text-sm">{s.note}</p> : null}
                <AddToBag p={p} label={s.buttonLabel || "Add to bag"} className={`sf-spot-add sf-spot-add-${s.buttonStyle}`} />
                {s.detailsLabel ? (
                  <Link href={paths.product(p.slug)} className="sf-underline-link">
                    {s.detailsLabel}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const WAVE_TOP = "M0 40 C 180 10 360 10 540 28 C 720 46 900 46 1080 26 C 1260 6 1350 14 1440 22 L1440 60 L0 60 Z";
const WAVE_BOTTOM = "M0 0 L1440 0 L1440 30 C 1260 52 1080 56 900 38 C 720 20 540 18 360 34 C 180 50 90 44 0 34 Z";

async function FeatureBand({ s, ctx }: P<"FeatureBand">) {
  const args = sourceArgs(s);
  const cards = args ? (await listProducts(ctx.sf.tenant.tenantId, args)).cards : [];
  if (!cards.length && !s.imagePath) return null;
  const settings = { ...ctx.sf.theme.productCard, showBrand: false, showSizes: false, showQuickAdd: false, showRating: false, showBadges: false };
  const feature = (
    <>
      <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 1024px) 30vw, 100vw" />
      {s.featureHeading || s.featureEyebrow ? (
        <span className="sf-band-feature-text">
          {s.featureEyebrow ? <span className="sf-eyebrow block !text-current opacity-90">{s.featureEyebrow}</span> : null}
          {s.featureHeading ? (
            <span className="sf-heading mt-2 block text-3xl leading-tight">
              {s.featureHeading}
              {s.featureAccent ? <em className="block">{s.featureAccent}</em> : null}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  // band-reverse: cards first, photo on the right (wide screens). band-stacked: a wide photo banner above the cards.
  const reverse = s.variant === "band-reverse";
  const stacked = s.variant === "band-stacked";
  const bandCols = stacked ? "" : reverse ? "@[64rem]:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]" : "@[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]";
  const featureShape = stacked ? "aspect-[4/3] @[48rem]:aspect-[21/9]" : `aspect-[4/5] @[64rem]:aspect-auto${reverse ? " @[64rem]:order-2" : ""}`;
  return (
    <section className={`sf-band sf-band-${s.tone}`}>
      {s.edge === "wave" ? (
        <svg aria-hidden className="sf-band-wave" viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d={WAVE_TOP} />
        </svg>
      ) : null}
      <div className="sf-band-inner">
        <div className="sf-container">
          <div className={`grid gap-6 @[64rem]:gap-7 ${bandCols}`}>
            {stacked ? null : <div className={`hidden @[64rem]:block ${reverse ? "@[64rem]:order-2" : ""}`} />}
            {s.heading ? (
              <h2 className={headingClass(s.headingStyle, "sf-heading text-center text-3xl @[64rem]:text-4xl")}>
                <HeadingText heading={s.heading} accent={s.headingAccent} />
              </h2>
            ) : null}
          </div>
          <div className={`mt-6 grid gap-6 @[64rem]:gap-7 ${bandCols}`}>
            {s.imagePath ? (
              s.featureHref ? (
                <Link href={s.featureHref} className={`sf-band-feature relative block overflow-hidden ${featureShape}`}>
                  {feature}
                </Link>
              ) : (
                <div className={`sf-band-feature relative overflow-hidden ${featureShape}`}>{feature}</div>
              )
            ) : stacked ? null : (
              <div />
            )}
            <ul className="sf-band-cards grid grid-cols-2 gap-3 @[48rem]:grid-cols-4">
              {cards.slice(0, s.limit).map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} settings={settings} />
                </li>
              ))}
            </ul>
          </div>
          {s.ctaLabel && s.ctaHref ? (
            <div className="mt-8 text-center">
              <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-light" />
            </div>
          ) : null}
        </div>
      </div>
      {s.edge === "wave" ? (
        <svg aria-hidden className="sf-band-wave" viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d={WAVE_BOTTOM} />
        </svg>
      ) : null}
    </section>
  );
}

type EditorialProps = { s: SectionSettings<"EditorialImageText">; heading: string; body: string; href: string; imagePath: string };

/** Full-bleed banner: text over the image, optional logo and thumbnail strip. */
function EditorialFullbleed({ s, ctx, heading, href, imagePath }: EditorialProps & { ctx: RenderContext }) {
  const logo = s.showLogo ? storeImageSrc(ctx.sf.theme.header.logoPath || ctx.sf.store.logoPath) : null;
  return (
    <section className="sf-fullbleed relative isolate overflow-hidden text-white">
      <div className="absolute inset-0 -z-10">
        <StoreImage path={imagePath} alt={s.alt} sizes="100vw" />
        <div aria-hidden className="sf-fullbleed-shade absolute inset-0" />
      </div>
      <div className="sf-container flex min-h-[34rem] flex-col justify-between gap-10 py-14 @[64rem]:min-h-[38rem] @[64rem]:py-20">
        <div className="max-w-md space-y-4 @[64rem]:pl-6">
          {s.eyebrow ? <p className="sf-eyebrow !text-white/90">{s.eyebrow}</p> : null}
          {heading ? (
            <h2 className={headingClass(s.headingStyle, "sf-heading text-4xl @[64rem]:text-5xl")}>
              {heading}
              {s.headingAccent ? <em className="sf-fullbleed-accent block">{s.headingAccent}</em> : null}
            </h2>
          ) : null}
          {s.subheading ? <p className="text-sm font-medium">{s.subheading}</p> : null}
          <Cta label={s.ctaLabel} href={href} className="sf-btn sf-btn-light" />
        </div>
        <div className="flex items-end justify-between gap-6">
          {s.thumbs.length ? (
            <ul className="sf-fullbleed-thumbs mx-auto flex gap-2 overflow-x-auto">
              {s.thumbs.map((t, i) => {
                const img = (
                  <span className={`relative block h-16 w-12 overflow-hidden @[64rem]:h-[4.75rem] @[64rem]:w-16 ${i === 0 ? "is-active" : ""}`}>
                    <StoreImage path={t.imagePath} alt={t.alt} sizes="64px" />
                  </span>
                );
                return <li key={i}>{t.href ? <Link href={t.href}>{img}</Link> : img}</li>;
              })}
            </ul>
          ) : (
            <span />
          )}
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo with intrinsic ratio
            <img src={logo} alt="" className="sf-fullbleed-logo hidden h-16 w-auto @[64rem]:block" />
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Journal: condensed display title and link, an image, and a numbered style note. */
function EditorialJournal({ s, heading, body, href, imagePath }: EditorialProps) {
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section grid items-center gap-8 @[48rem]:grid-cols-[1fr_1.2fr_1fr] @[64rem]:gap-14">
        <div className="space-y-5">
          {s.eyebrow ? <p className="sf-eyebrow !text-current">{s.eyebrow}</p> : null}
          {heading ? (
            <h2 className={`${headingClass(s.headingStyle === "default" ? "condensed" : s.headingStyle, "sf-heading text-4xl")} sf-journal-title`}>
              <HeadingText heading={heading} accent={s.headingAccent} />
            </h2>
          ) : null}
          {s.subheading ? <p className="sf-muted whitespace-pre-line leading-relaxed">{s.subheading}</p> : null}
          {s.ctaLabel && href ? (
            <Link href={href} className="sf-underline-link">
              {s.ctaLabel}
            </Link>
          ) : null}
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--sf-radius-card)]">
          <StoreImage path={imagePath} alt={s.alt} sizes="(min-width: 768px) 36vw, 100vw" />
        </div>
        <div className="space-y-4">
          {s.noteEyebrow ? <p className="sf-eyebrow !text-current">{s.noteEyebrow}</p> : null}
          {s.noteHeading ? <h3 className="sf-heading whitespace-pre-line text-3xl leading-tight">{s.noteHeading}</h3> : null}
          {body ? <p className="sf-muted whitespace-pre-line leading-relaxed">{body}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** Heading on the left, arch-topped images on the right (each can link to a product). */
async function LookbookArches({ s, ctx }: P<"Lookbook">) {
  const ids = s.looks.map((l) => l.productId).filter(Boolean);
  const refs = ids.length ? await getProductRefs(ctx.sf.tenant.tenantId, ids) : new Map<string, { slug: string; title: string }>();
  const looks = s.looks.slice(0, 4);
  return (
    <section className="sf-container sf-section grid items-center gap-8 @[64rem]:grid-cols-[1fr_2.6fr] @[64rem]:gap-12">
      <div className="space-y-3">
        {s.eyebrow ? <p className="sf-eyebrow !text-current">{s.eyebrow}</p> : null}
        {s.heading ? (
          <h2 className={headingClass(s.headingStyle, "sf-heading text-4xl @[64rem]:text-5xl")}>
            {s.heading}
            {s.headingAccent ? <em className="sf-heading-accent block">{s.headingAccent}</em> : null}
          </h2>
        ) : null}
        {s.subheading ? <p className="sf-muted text-sm">{s.subheading}</p> : null}
      </div>
      <ul className={`grid gap-3 @[48rem]:gap-5 ${looks.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {looks.map((l, i) => {
          const ref = l.productId ? refs.get(l.productId) : undefined;
          const img = (
            <div className="sf-arch relative aspect-[3/4] overflow-hidden @[64rem]:aspect-[27/28]">
              <StoreImage path={l.imagePath} alt={l.alt} sizes="(min-width: 1024px) 22vw, 33vw" className="transition duration-700 group-hover:scale-105" />
            </div>
          );
          return (
            <li key={i}>
              {ref ? (
                <Link href={paths.product(ref.slug)} className="group block" aria-label={l.alt || ref.title}>
                  {img}
                </Link>
              ) : (
                img
              )}
              {l.caption ? <p className="sf-muted mt-2 text-center text-sm">{l.caption}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Tall looks in a swipeable row (CSS scroll-snap); each can link to its product. */
async function LookbookRail({ s, ctx }: P<"Lookbook">) {
  const ids = s.looks.map((l) => l.productId).filter(Boolean);
  const refs = ids.length ? await getProductRefs(ctx.sf.tenant.tenantId, ids) : new Map<string, { slug: string; title: string }>();
  return (
    <section className="sf-container sf-section">
      <Intro {...hp(s)} />
      <ul className="sf-scroll-row -mx-4 px-4 @[48rem]:mx-0 @[48rem]:px-0" aria-label={s.heading || "Lookbook"}>
        {s.looks.map((l, i) => {
          const ref = l.productId ? refs.get(l.productId) : undefined;
          const img = (
            <span className="relative block aspect-[2/3] overflow-hidden rounded-[var(--sf-radius-card)]">
              <StoreImage path={l.imagePath} alt={l.alt} sizes="(min-width: 1024px) 26vw, 70vw" className="transition duration-700 group-hover:scale-105" />
            </span>
          );
          return (
            <li key={i} className="sf-rail-item w-[70%] shrink-0 @[48rem]:w-[38%] @[64rem]:w-[26%]">
              {ref ? (
                <Link href={paths.product(ref.slug)} className="group block">
                  {img}
                  <span className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="sf-muted">{l.caption || ref.title}</span>
                    <span aria-hidden className="opacity-60 transition group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              ) : (
                <>
                  {img}
                  {l.caption ? <p className="sf-muted mt-2 text-sm">{l.caption}</p> : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Marker only: the page places its own content here (see splitAtPageContent). */
function PageContent() {
  return null;
}

/** Decorative divider: original line motifs (public/illustrations) masked in the theme colour, optional public-domain painting. */
function DecorDivider({ s }: P<"DecorDivider">) {
  const motif = (name: string, extra = "") => <span aria-hidden className={`sf-motif sf-motif-${name} ${extra}`} />;
  if (s.layout === "margins") {
    return (
      <div aria-hidden className="sf-decor-margins">
        {motif("peacock", "sf-decor-margin-l")}
        {motif("peacock", "sf-decor-margin-r")}
      </div>
    );
  }
  const art = s.artwork !== "none" ? DECOR_ARTWORKS[s.artwork] : null;
  const ornament =
    s.motif === "krishna" ? (
      <div aria-hidden className="sf-decor-ornament is-krishna">
        {motif("peacock", "sf-decor-feather-l")}
        <span className="sf-decor-line" />
        {motif("bansuri", "sf-decor-center")}
        <span className="sf-decor-line" />
        {motif("peacock", "sf-decor-feather-r")}
      </div>
    ) : (
      <div aria-hidden className={`sf-decor-ornament is-${s.motif}`}>
        <span className="sf-decor-line" />
        {motif(s.motif, "sf-decor-center")}
        <span className="sf-decor-line" />
      </div>
    );
  if (s.layout === "decor-title") {
    // The motif framing a centred heading and text (a section title ornament); no painting.
    if (!s.heading && !s.text) return <div className="sf-decor sf-container">{ornament}</div>;
    return (
      <section className="sf-decor sf-decor-title sf-container text-center">
        {ornament}
        {s.heading ? <h2 className="sf-heading mx-auto mt-4 max-w-2xl text-3xl @[64rem]:text-4xl">{s.heading}</h2> : null}
        {s.text ? <p className="sf-muted mx-auto mt-3 max-w-xl leading-relaxed">{s.text}</p> : null}
        <div aria-hidden className="sf-decor-ornament is-plain mx-auto mt-6">
          <span className="sf-decor-line" />
        </div>
      </section>
    );
  }
  if (!art) return <div className="sf-decor sf-container">{ornament}</div>;
  return (
    <section className="sf-decor sf-decor-art sf-container" aria-label={s.heading || art.title}>
      {motif("lotus", "sf-decor-art-lotus")}
      <figure className="sf-decor-figure">
        {/* eslint-disable-next-line @next/next/no-img-element -- static public-domain artwork from /public */}
        <img src={art.src} width={art.width} height={art.height} alt={art.title} loading="lazy" decoding="async" />
        <figcaption>
          <span className="sf-decor-art-title">{art.title}</span> {art.credit}
        </figcaption>
      </figure>
      <div className="sf-decor-copy">
        {motif("bansuri", "sf-decor-copy-flute")}
        {s.heading ? <h2 className="sf-heading sf-decor-heading">{s.heading}</h2> : null}
        {s.text ? <p className="sf-muted sf-decor-text">{s.text}</p> : null}
        {motif("kadamba", "sf-decor-copy-vine")}
      </div>
    </section>
  );
}

export { splitAtPageContent } from "./split";

type Renderer<K extends SectionType> = (p: P<K>) => ReactNode | Promise<ReactNode>;

/** Section registry: type -> renderer. Unknown types never reach here (config is schema-validated). */
const REGISTRY: { [K in SectionType]: Renderer<K> } = {
  AnnouncementBar,
  Header,
  MegaMenu,
  Hero,
  PromoBanner,
  CategoryGrid,
  CollectionGrid,
  ProductCarousel: ProductCarouselSection,
  ProductGrid: ProductGridSection,
  Bestseller,
  NewArrivals,
  SaleBanner,
  EditorialImageText,
  VideoBanner,
  Lookbook,
  BrandStory,
  Testimonials,
  Reviews: ReviewsSection,
  SocialProof,
  Newsletter,
  FAQ,
  TrustBadges,
  Marquee,
  BrandStrip,
  VideoShop,
  ProductSpotlight,
  CompactProducts,
  FeatureBand,
  DecorDivider,
  PageContent,
  ...PAGE_SECTION_RENDERERS,
  Footer,
};

function visibilityClass(section: SectionInstance): string {
  const v = section.visibility;
  if (v.desktop && !v.mobile) return "sf-hide-mobile";
  if (!v.desktop && v.mobile) return "sf-hide-desktop";
  return "";
}

/** Inline CSS variables for a section's colour overrides (validated hex only; see config.ts). */
function sectionStyleVars(style: SectionInstance["style"]): CSSProperties | undefined {
  if (!style) return undefined;
  const v: Record<string, string> = {};
  const bg = HEX_COLOR_RE.test(style.background) ? style.background : "";
  const text = HEX_COLOR_RE.test(style.text) ? style.text : "";
  const accent = HEX_COLOR_RE.test(style.accent) ? style.accent : "";
  if (bg) Object.assign(v, { "--sf-bg": bg, backgroundColor: bg });
  if (text) Object.assign(v, { "--sf-text": text, color: text });
  if (bg || text) {
    const t = text || "var(--sf-text)";
    const b = bg || "var(--sf-bg)";
    Object.assign(v, { "--sf-muted": `color-mix(in srgb, ${t} 62%, ${b})`, "--sf-surface": `color-mix(in srgb, ${t} 4%, ${b})` });
  }
  if (accent) Object.assign(v, { "--sf-accent": accent, "--sf-accent-fg": readableOn(accent) });
  return Object.keys(v).length ? (v as CSSProperties) : undefined;
}

/**
 * Renders a list of sections. `slot` is set only in the theme preview (site builder canvas): each
 * wrapper then carries data attributes the canvas uses to outline and select sections.
 */
export function SectionList({ sections, ctx, slot }: { sections: SectionInstance[]; ctx: RenderContext; slot?: string }) {
  return (
    <>
      {sections.map((section) => {
        if (isSectionHidden(section)) return null;
        const Render = REGISTRY[section.type] as Renderer<SectionType>;
        const cls = visibilityClass(section);
        const node = <Render s={section.settings as never} ctx={ctx} />;
        // Per-section rhythm (sections/variants SECTION_SPACINGS); CSS adjusts the inner .sf-section padding.
        const spacing = (section.settings as { spacing?: unknown }).spacing;
        const sp = typeof spacing === "string" && spacing !== "default" ? spacing : undefined;
        const colours = sectionStyleVars(section.style);
        // Size & spacing (validated numbers / enums only). Custom properties inherit through
        // display:contents, so the wrapper stays "contents" (sticky headers keep working).
        const box = sectionBoxVars(section.box);
        const style = box ? ({ ...colours, ...box.vars } as CSSProperties) : colours;
        const builder = slot ? { "data-section-id": section.id, "data-builder-slot-item": slot } : {};
        return (
          <div key={section.id} id={`s-${section.id}`} className={cls || (colours ? "flow-root" : "contents")} style={style} data-section={section.type} data-spacing={sp} {...box?.attrs} {...builder}>
            {node}
          </div>
        );
      })}
    </>
  );
}
