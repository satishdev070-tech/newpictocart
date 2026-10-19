import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import type { SectionType } from "@/features/theme/sections/types";
import type { ProductCardData, ListArgs } from "@/features/storefront/server/catalog";
import { listProducts } from "@/features/storefront/server/catalog";
import { paths } from "@/features/storefront/urls";
import { ProductCard, productPlaceholder } from "@/features/storefront/components/product-card";
import { isInformative } from "@/features/stores/site-mode";
import { Price, Stars } from "@/features/storefront/components/price";
import { StoreArtImage, StoreImage, type ImageFallback } from "@/features/storefront/components/store-image";
import { NewsletterForm } from "@/features/storefront/components/islands";
import { assetUrl } from "@/lib/storage/assets";
import { pickStock, type StockImage, type StockSet } from "@/lib/unsplash-stock";
import type { ProductCardSettings } from "@/features/theme/schema/tokens";
import type { CardRatio, CategoryVariant, ProductGridVariant } from "@/features/theme/sections/variants";
import { Cta, Intro, hp, type IntroProps } from "./parts";
import type { RenderContext } from "./context";

/**
 * Layout variants of the core sections (sections/variants.ts). Server components only: rails use
 * CSS scroll-snap and strips use CSS animation, so no variant adds client JavaScript. Empty image
 * slots fall back to the store's stock photos (ctx.stock), credited with <PhotoCredit>.
 */

type P<T extends SectionType> = { s: SectionSettings<T>; ctx: RenderContext };

/** "Photo: Name / Unsplash" for a stock photo shown in place of the seller's own image. */
export function PhotoCredit({ img, className = "" }: { img: StockImage | ImageFallback | null | undefined; className?: string }) {
  const photo = img && "photographer" in img ? img : null;
  if (!photo?.photographer) return null;
  return (
    <p className={`sf-photo-credit ${className}`}>
      Photo:{" "}
      <a href={photo.photographer.url} rel="noopener noreferrer" target="_blank">
        {photo.photographer.name}
      </a>{" "}
      /{" "}
      <a href={photo.unsplashUrl} rel="noopener noreferrer" target="_blank">
        Unsplash
      </a>
    </p>
  );
}

/** Stock fallback for an image slot: only when the seller left the slot empty. */
export function stockFor(ctx: RenderContext, path: string | null | undefined, slot: "hero" | "story" | "tiles" | "products", n = 0): StockImage | null {
  return assetUrl(path) ? null : pickStock(ctx.stock, slot, n);
}

const RATIO: Record<string, string> = { portrait: "aspect-[3/4]", square: "aspect-square", landscape: "aspect-[4/3]", tall: "aspect-[2/3]" };

/** Product card settings for one section (per-section image shape override). */
export function cardSettings(base: ProductCardSettings, ratio: CardRatio | undefined): ProductCardSettings {
  return ratio && ratio !== "theme" ? { ...base, imageRatio: ratio } : base;
}

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------
type Slide = SectionSettings<"Hero">["slides"][number];

function HeroText({ sl, first, size = "lg", light = false }: { sl: Slide; first: boolean; size?: "lg" | "xl"; light?: boolean }) {
  const H = first ? "h1" : "h2";
  return (
    <div className="space-y-4">
      {sl.eyebrow ? <p className="sf-eyebrow !text-current opacity-80">{sl.eyebrow}</p> : null}
      <H className={`sf-heading ${size === "xl" ? "text-5xl @[48rem]:text-6xl @[64rem]:text-8xl" : "text-4xl @[64rem]:text-6xl"}`}>
        {sl.heading}
        {sl.headingAccent ? <em className="sf-hero-accent">{sl.headingAccent}</em> : null}
      </H>
      {sl.subheading ? <p className="max-w-xl text-lg opacity-85">{sl.subheading}</p> : null}
      <Cta label={sl.ctaLabel} href={sl.ctaHref} className={light ? "sf-btn sf-btn-light" : "sf-btn"} />
    </div>
  );
}

function SlideImage({ sl, stock, sizes, priority }: { sl: Slide; stock: StockImage | null; sizes: string; priority: boolean }) {
  return sl.mobileImagePath ? (
    <StoreArtImage path={sl.imagePath} mobilePath={sl.mobileImagePath} alt={sl.alt} sizes={sizes} priority={priority} stock={stock} />
  ) : (
    <StoreImage path={sl.imagePath} alt={sl.alt} sizes={sizes} priority={priority} stock={stock} />
  );
}

const mediaAspect = (r: string, auto: string) => (r === "portrait" ? "aspect-[4/5]" : r === "square" ? "aspect-square" : r === "landscape" ? "aspect-[4/3]" : auto);

export function HeroVariant({ s, ctx }: P<"Hero">) {
  const slides = s.slides;
  const first = slides[0]!;
  const stock = (i: number) => stockFor(ctx, slides[i]?.imagePath, "hero", i);
  const panel = `sf-tone-${s.panelTone}`;
  const textSide = first.align === "right" ? "@[48rem]:[&>*:first-child]:order-2" : "";
  const centred = first.align === "center";

  switch (s.variant) {
    case "split":
      return (
        <section className={`sf-hero-split grid @[48rem]:grid-cols-2 ${panel} ${textSide}`}>
          <div className={`relative ${mediaAspect(s.mediaRatio, "aspect-[4/5] @[48rem]:aspect-auto @[48rem]:min-h-[78svh]")}`}>
            <SlideImage sl={first} stock={stock(0)} sizes="(min-width: 768px) 50vw, 100vw" priority />
            <PhotoCredit img={stock(0)} className="sf-photo-credit-on" />
          </div>
          <div className={`flex items-center px-6 py-12 @[48rem]:px-12 @[64rem]:px-20 ${centred ? "justify-center text-center" : ""}`}>
            <div className="max-w-lg">
              <HeroText sl={first} first />
            </div>
          </div>
        </section>
      );
    case "collage": {
      const imgs = [0, 1, 2].map((i) => ({ sl: slides[i] ?? { ...first, imagePath: "", mobileImagePath: "", alt: "" }, stock: stockFor(ctx, slides[i]?.imagePath, "hero", i) }));
      return (
        <section className={`${panel} overflow-hidden`}>
          <div className="sf-container grid items-center gap-10 py-12 @[64rem]:grid-cols-[1.1fr_1fr] @[64rem]:py-20">
            <div className={centred ? "text-center" : ""}>
              <HeroText sl={first} first size="xl" />
            </div>
            <div className="sf-hero-collage" aria-hidden={imgs.every((x) => !x.sl.alt) || undefined}>
              {imgs.map((x, i) => (
                <div key={i} className={`sf-hero-collage-${i + 1} relative overflow-hidden rounded-[var(--sf-radius-card)]`}>
                  <StoreImage path={x.sl.imagePath} alt={x.sl.alt} sizes="(min-width: 1024px) 25vw, 50vw" priority={i === 0} stock={x.stock} />
                </div>
              ))}
              <PhotoCredit img={imgs[0]!.stock} className="sf-hero-collage-credit" />
            </div>
          </div>
        </section>
      );
    }
    case "minimal":
      return (
        <section className={panel}>
          <div className="sf-container pb-10 pt-14 text-center @[64rem]:pt-24">
            <div className="mx-auto max-w-4xl">
              <HeroText sl={first} first size="xl" />
            </div>
          </div>
          <div className="sf-container pb-12">
            <div className={`relative overflow-hidden rounded-[var(--sf-radius-card)] ${mediaAspect(s.mediaRatio, "aspect-[4/3] @[48rem]:aspect-[21/9]")}`}>
              <SlideImage sl={first} stock={stock(0)} sizes="100vw" priority />
            </div>
            <PhotoCredit img={stock(0)} className="mt-2 text-right" />
          </div>
        </section>
      );
    case "band":
      return (
        <section className={panel}>
          <div className="relative aspect-[4/3] w-full @[48rem]:aspect-[21/8]">
            <SlideImage sl={first} stock={stock(0)} sizes="100vw" priority />
            <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: s.overlay / 200 }} />
            <PhotoCredit img={stock(0)} className="sf-photo-credit-on" />
          </div>
          <div className="sf-container grid gap-6 py-10 @[64rem]:grid-cols-[1.4fr_1fr] @[64rem]:items-end @[64rem]:py-14">
            <div className="space-y-3">
              {first.eyebrow ? <p className="sf-eyebrow !text-current opacity-80">{first.eyebrow}</p> : null}
              <h1 className="sf-heading text-4xl @[64rem]:text-7xl">
                {first.heading}
                {first.headingAccent ? <em className="sf-hero-accent">{first.headingAccent}</em> : null}
              </h1>
            </div>
            <div className="space-y-5">
              {first.subheading ? <p className="text-lg opacity-85">{first.subheading}</p> : null}
              <Cta label={first.ctaLabel} href={first.ctaHref} />
            </div>
          </div>
        </section>
      );
    case "cards": {
      // At least three cards: extra stock photos fill the row when the seller has one or two slides.
      const cards: { sl: Slide | null; stock: StockImage | null }[] = slides.map((sl, i) => ({ sl, stock: stock(i) }));
      for (let i = cards.length; i < 3 && ctx.stock; i++) cards.push({ sl: null, stock: pickStock(ctx.stock, "hero", i) });
      return (
        <section className={`${panel} py-6 @[48rem]:py-10`}>
          <ul className="sf-scroll-row sf-hero-cards px-4 @[48rem]:px-8" aria-label="Featured">
            {cards.map((c, i) => (
              <li key={i} className="sf-hero-card relative shrink-0 overflow-hidden rounded-[calc(var(--sf-radius-card)+8px)]">
                {c.sl ? <SlideImage sl={c.sl} stock={c.stock} sizes="(min-width: 768px) 70vw, 88vw" priority={i === 0} /> : <StoreImage path="" alt="" sizes="(min-width: 768px) 70vw, 88vw" stock={c.stock} />}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                {c.sl && (c.sl.heading || c.sl.ctaLabel) ? (
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white @[48rem]:p-10">
                    <HeroText sl={c.sl} first={i === 0} light />
                  </div>
                ) : first.ctaHref ? (
                  <Link href={first.ctaHref} aria-label={first.ctaLabel || "Shop now"} className="absolute inset-0" />
                ) : null}
                <PhotoCredit img={c.stock} className="sf-photo-credit-on" />
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "framed":
      return (
        <section className={`${panel} py-4 @[48rem]:py-8`}>
          <div className="sf-container">
            <div className="relative">
              <div className={`relative overflow-hidden rounded-[calc(var(--sf-radius-card)+12px)] ${mediaAspect(s.mediaRatio, "aspect-[4/5] @[48rem]:aspect-[16/8]")}`}>
                <SlideImage sl={first} stock={stock(0)} sizes="100vw" priority />
                <PhotoCredit img={stock(0)} className="sf-photo-credit-on sf-photo-credit-top" />
              </div>
              <div className={`sf-hero-frame-card relative -mt-16 mx-3 max-w-xl p-6 shadow-xl @[48rem]:absolute @[48rem]:bottom-10 @[48rem]:mx-0 @[48rem]:mt-0 @[48rem]:p-10 ${first.align === "right" ? "@[48rem]:right-10" : "@[48rem]:left-10"} ${centred ? "text-center" : ""}`}>
                <HeroText sl={first} first />
              </div>
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Product grids
// -----------------------------------------------------------------------------
export async function ProductGridVariant({ ctx, args, variant, intro, cardRatio, columns = 4 }: { ctx: RenderContext; args: ListArgs | null; variant: ProductGridVariant; intro: IntroProps; cardRatio?: CardRatio; columns?: number }) {
  if (!args) return null;
  const { cards } = await listProducts(ctx.sf.tenant.tenantId, args);
  const stock: StockSet | null = ctx.stockProducts ? ctx.stock : null;
  const settings = cardSettings(ctx.sf.theme.productCard, cardRatio);
  return (
    <section className="sf-container sf-section">
      <Intro {...intro} />
      {!cards.length ? <p className="sf-muted text-sm">Products will appear here soon.</p> : <ProductLayout cards={cards} variant={variant} settings={settings} stock={stock} columns={columns} commerceEnabled={!isInformative(ctx.sf.siteMode)} />}
    </section>
  );
}

export function ProductLayout({ cards, variant, settings, stock, columns, commerceEnabled = true }: { cards: ProductCardData[]; variant: ProductGridVariant; settings: ProductCardSettings; stock: StockSet | null; columns: number; commerceEnabled?: boolean }) {
  const card = (p: ProductCardData, s = settings) => <ProductCard product={p} settings={s} placeholder={productPlaceholder(stock, p)} commerceEnabled={commerceEnabled} />;
  switch (variant) {
    case "masonry": {
      const ratios = ["tall", "portrait", "square", "portrait"] as const;
      return (
        <ul className={`sf-masonry columns-2 gap-4 @[48rem]:columns-3 ${columns >= 4 ? "@[64rem]:columns-4" : ""}`}>
          {cards.map((p, i) => (
            <li key={p.id} className="mb-6 break-inside-avoid">
              {card(p, { ...settings, imageRatio: ratios[i % ratios.length]! })}
            </li>
          ))}
        </ul>
      );
    }
    case "lookbook": {
      const [lead, ...rest] = cards;
      return (
        <div className="grid gap-4 @[64rem]:grid-cols-2 @[64rem]:gap-6">
          <BigTile p={lead!} stock={stock} className="aspect-[4/5] @[64rem]:aspect-auto @[64rem]:h-full" priority />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6">
            {rest.slice(0, 4).map((p) => (
              <li key={p.id}>{card(p, { ...settings, imageRatio: "square" })}</li>
            ))}
          </ul>
        </div>
      );
    }
    case "rail":
      return (
        <ul className="sf-scroll-row -mx-4 px-4 @[48rem]:mx-0 @[48rem]:px-0">
          {cards.map((p) => (
            <li key={p.id} className="sf-rail-item w-[62%] shrink-0 @[48rem]:w-[34%] @[64rem]:w-[23%]">
              {card(p)}
            </li>
          ))}
        </ul>
      );
    case "bigtile":
      return (
        <ul className="grid gap-4 @[48rem]:grid-cols-2 @[48rem]:gap-6">
          {cards.map((p) => (
            <li key={p.id}>
              <BigTile p={p} stock={stock} className="aspect-[4/5] @[64rem]:aspect-[5/6]" />
            </li>
          ))}
        </ul>
      );
    case "list":
      return (
        <ul className="sf-product-list grid gap-x-10 @[64rem]:grid-cols-2">
          {cards.map((p) => (
            <li key={p.id}>
              <Link href={paths.product(p.slug)} className="group flex items-center gap-4 py-4">
                <span className={`relative w-24 shrink-0 overflow-hidden rounded-[var(--sf-radius-card)] @[48rem]:w-28 ${RATIO[settings.imageRatio] ?? "aspect-square"}`}>
                  <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="112px" stock={productPlaceholder(stock, p)} className="transition duration-500 group-hover:scale-105" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  {settings.showBrand && p.brand ? <span className="sf-eyebrow block">{p.brand}</span> : null}
                  <span className="sf-heading block text-lg leading-snug @[64rem]:text-xl">{p.title}</span>
                  {p.ratingCount > 0 ? <Stars rating={p.ratingAvg} count={p.ratingCount} small /> : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <Price priceMinor={p.priceMinor} compareAtMinor={p.compareAtMinor} fromPrice={p.hasPriceRange} showCompare={settings.showComparePrice} size="sm" />
                  <span aria-hidden className="sf-list-go">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

/** A large product photo with the name and price on it. */
function BigTile({ p, stock, className, priority = false }: { p: ProductCardData; stock: StockSet | null; className: string; priority?: boolean }) {
  return (
    <Link href={paths.product(p.slug)} className={`group relative block overflow-hidden rounded-[var(--sf-radius-card)] ${className}`}>
      <StoreImage path={p.imagePath} alt={p.imageAlt || p.title} sizes="(min-width: 768px) 50vw, 100vw" priority={priority} stock={productPlaceholder(stock, p)} className="transition duration-700 group-hover:scale-105" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white @[64rem]:p-8">
        <span className="min-w-0">
          {p.brand ? <span className="block text-[0.7rem] uppercase tracking-[0.2em] opacity-80">{p.brand}</span> : null}
          <span className="sf-heading block text-2xl @[64rem]:text-3xl">{p.title}</span>
        </span>
        <span className="sf-bigtile-price shrink-0">
          <Price priceMinor={p.priceMinor} compareAtMinor={null} fromPrice={p.hasPriceRange} size="sm" />
        </span>
      </span>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Tiles (categories / collections)
// -----------------------------------------------------------------------------
export type Tile = { href: string; label: string; imagePath: string | null; subtitle?: string };

export function TileLayout({ tiles, variant, intro, ctx }: { tiles: Tile[]; variant: Exclude<CategoryVariant, "grid">; intro: IntroProps; ctx: RenderContext }) {
  const stockAt = (t: Tile, i: number) => stockFor(ctx, t.imagePath, "tiles", i);
  let body: ReactNode;
  switch (variant) {
    case "mosaic":
      // One large tile + 4 (or + 8) fills the 4-column grid evenly.
      body = (
        <ul className="sf-mosaic grid grid-cols-2 gap-3 @[64rem]:grid-cols-4 @[64rem]:gap-5">
          {tiles.slice(0, tiles.length >= 9 ? 9 : tiles.length >= 5 ? 5 : tiles.length).map((t, i) => (
            <li key={t.href} className={i === 0 ? "col-span-2 row-span-2" : ""}>
              <Link href={t.href} className="group relative block aspect-square h-full overflow-hidden rounded-[var(--sf-radius-card)]">
                <StoreImage path={t.imagePath} alt="" sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} stock={stockAt(t, i)} className="transition duration-700 group-hover:scale-105" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-0 left-0 p-4 text-white @[64rem]:p-6">
                  <span className={`sf-heading block ${i === 0 ? "text-3xl @[64rem]:text-5xl" : "text-xl @[64rem]:text-2xl"}`}>{t.label}</span>
                  {t.subtitle ? <span className="mt-1 block text-xs uppercase tracking-[0.12em] opacity-85">{t.subtitle}</span> : i === 0 ? <span className="mt-2 inline-block text-xs uppercase tracking-[0.18em] opacity-90">Shop now →</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "rail":
      body = (
        <ul className="sf-scroll-row -mx-4 px-4 @[48rem]:mx-0 @[48rem]:px-0">
          {tiles.map((t, i) => (
            <li key={t.href} className="sf-rail-item w-[44%] shrink-0 @[48rem]:w-[28%] @[64rem]:w-[19%]">
              <Link href={t.href} className="group block">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[var(--sf-radius-card)]">
                  <StoreImage path={t.imagePath} alt="" sizes="(min-width: 1024px) 20vw, 45vw" stock={stockAt(t, i)} className="transition duration-500 group-hover:scale-105" />
                </span>
                <span className="mt-3 flex items-center justify-between gap-2 text-sm font-medium">
                  {t.label}
                  <span aria-hidden className="opacity-60 transition group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "index":
      body = (
        <ol className="sf-index border-t border-[var(--sf-border)]">
          {tiles.map((t, i) => (
            <li key={t.href} className="border-b border-[var(--sf-border)]">
              <Link href={t.href} className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-4 @[64rem]:grid-cols-[4rem_1fr_7rem_2rem] @[64rem]:py-6">
                <span className="sf-muted text-xs tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="sf-heading text-2xl transition group-hover:translate-x-2 @[64rem]:text-5xl">{t.label}</span>
                <span className="relative hidden aspect-[4/3] overflow-hidden rounded-[var(--sf-radius-card)] @[64rem]:block">
                  <StoreImage path={t.imagePath} alt="" sizes="112px" stock={stockAt(t, i)} />
                </span>
                <span aria-hidden className="text-xl opacity-60 transition group-hover:opacity-100">↗</span>
              </Link>
            </li>
          ))}
        </ol>
      );
      break;
    case "pills":
      body = (
        <ul className="flex flex-wrap justify-center gap-2.5 @[64rem]:gap-3">
          {tiles.map((t, i) => (
            <li key={t.href}>
              <Link href={t.href} className="sf-pill-tile">
                <span className="relative size-10 shrink-0 overflow-hidden rounded-full @[64rem]:size-12">
                  <StoreImage path={t.imagePath} alt="" sizes="96px" stock={stockAt(t, i)} />
                </span>
                <span className="pr-2 text-sm font-medium">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
  }
  return (
    <section className="sf-container sf-section">
      <Intro {...intro} />
      {body}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Brand story
// -----------------------------------------------------------------------------
function StoryText({ s, centred = false, big = false }: { s: SectionSettings<"BrandStory">; centred?: boolean; big?: boolean }) {
  return (
    <div className={`space-y-5 ${centred ? "text-center" : ""}`}>
      {s.eyebrow ? <p className="sf-eyebrow !text-current opacity-75">{s.eyebrow}</p> : null}
      <h2 className={`sf-heading ${big ? "text-4xl @[64rem]:text-6xl" : "text-3xl @[64rem]:text-5xl"}`}>{s.heading}</h2>
      {s.subheading ? <p className="text-lg">{s.subheading}</p> : null}
      {s.body ? <p className={`whitespace-pre-line leading-relaxed opacity-80 ${centred ? "mx-auto max-w-2xl" : ""}`}>{s.body}</p> : null}
      <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-outline" />
    </div>
  );
}

function Stats({ stats, big = false, centred = false }: { stats: SectionSettings<"BrandStory">["stats"]; big?: boolean; centred?: boolean }) {
  if (!stats.length) return null;
  return (
    <dl className={`grid grid-cols-2 gap-6 ${stats.length > 2 ? "@[48rem]:grid-cols-4" : ""} ${centred ? "text-center" : ""}`}>
      {stats.map((st, i) => (
        <div key={i} className={big ? "sf-stat-big" : ""}>
          <dd className={`sf-heading ${big ? "text-5xl @[64rem]:text-7xl" : "text-3xl"}`}>{st.value}</dd>
          <dt className="mt-1 text-xs uppercase tracking-[0.16em] opacity-70">{st.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function StoryVariant({ s, ctx }: P<"BrandStory">) {
  const img = stockFor(ctx, s.imagePath, "story", 0);
  switch (s.variant) {
    case "centered":
      return (
        <section className={`sf-tone-${s.tone}`}>
          <div className="sf-container sf-section mx-auto max-w-4xl space-y-12">
            {s.imagePath || img ? (
              <div className="relative mx-auto aspect-square w-28 overflow-hidden rounded-full @[64rem]:w-36">
                <StoreImage path={s.imagePath} alt={s.alt} sizes="144px" stock={img} />
              </div>
            ) : null}
            <StoryText s={s} centred big />
            <Stats stats={s.stats} centred />
          </div>
        </section>
      );
    case "overlay":
      return (
        <section className="relative flex min-h-[70svh] items-center overflow-hidden">
          <StoreImage path={s.imagePath} alt={s.alt} sizes="100vw" stock={img} />
          <div aria-hidden className="absolute inset-0 bg-black/35" />
          <div className="sf-container relative py-16">
            <div className={`sf-tone-${s.tone === "light" ? "light" : s.tone} max-w-xl space-y-8 p-8 shadow-2xl @[64rem]:p-12 ${s.imagePosition === "left" ? "ml-auto" : ""}`}>
              <StoryText s={s} />
              <Stats stats={s.stats} />
            </div>
          </div>
          <PhotoCredit img={img} className="sf-photo-credit-on" />
        </section>
      );
    case "band":
      return (
        <section className={`sf-tone-${s.tone === "light" ? "dark" : s.tone}`}>
          <div className="sf-container sf-section grid gap-12 @[64rem]:grid-cols-[1fr_1.1fr] @[64rem]:items-center">
            <StoryText s={s} />
            {s.stats.length ? (
              <Stats stats={s.stats} big />
            ) : (
              <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--sf-radius-card)]">
                <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 1024px) 50vw, 100vw" stock={img} />
                <PhotoCredit img={img} className="sf-photo-credit-on" />
              </div>
            )}
          </div>
        </section>
      );
    case "collage": {
      const second = pickStock(ctx.stock, "story", 1);
      return (
        <section className={`sf-tone-${s.tone}`}>
          <div className={`sf-container sf-section grid items-center gap-12 @[48rem]:grid-cols-2 ${s.imagePosition === "left" ? "" : "@[48rem]:[&>*:first-child]:order-2"}`}>
            <div className="sf-story-collage relative">
              <div className="relative aspect-[4/5] w-[78%] overflow-hidden rounded-[var(--sf-radius-card)]">
                <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 768px) 40vw, 80vw" stock={img} />
              </div>
              {second ? (
                <div className="sf-story-collage-2 absolute bottom-[-8%] right-0 aspect-square w-[48%] overflow-hidden rounded-[var(--sf-radius-card)]">
                  <StoreImage path="" alt="" sizes="(min-width: 768px) 24vw, 48vw" stock={second} />
                </div>
              ) : null}
              <PhotoCredit img={img} className="mt-2" />
            </div>
            <div className="space-y-8">
              <StoryText s={s} />
              <Stats stats={s.stats} />
            </div>
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Testimonials
// -----------------------------------------------------------------------------
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

export function TestimonialsVariant({ s }: { s: SectionSettings<"Testimonials">; ctx: RenderContext }) {
  const items = s.items;
  const who = (t: (typeof items)[number]) => `${t.author}${t.location ? `, ${t.location}` : ""}`;
  let body: ReactNode;
  switch (s.variant) {
    case "spotlight": {
      const [lead, ...rest] = items;
      body = (
        <figure className="mx-auto max-w-4xl space-y-6 text-center">
          {lead!.rating ? <Stars rating={lead!.rating} /> : null}
          <blockquote className="sf-heading text-3xl leading-tight @[64rem]:text-5xl">“{lead!.quote}”</blockquote>
          <figcaption className="text-sm uppercase tracking-[0.18em] opacity-75">{who(lead!)}</figcaption>
          {rest.length ? <p className="sf-muted text-sm">Also loved by {rest.map((t) => t.author).join(", ")}</p> : null}
        </figure>
      );
      break;
    }
    case "cards":
      body = (
        <ul className="grid gap-4 @[48rem]:grid-cols-2 @[64rem]:grid-cols-3">
          {items.map((t, i) => (
            <li key={i} className="sf-quote-card flex flex-col gap-4 p-6">
              {t.rating ? <Stars rating={t.rating} small /> : null}
              <blockquote className="flex-1 leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="flex items-center gap-3 text-sm">
                <span aria-hidden className="sf-avatar">{initials(t.author)}</span>
                <span>
                  <span className="block font-medium">{t.author}</span>
                  {t.location ? <span className="sf-muted block text-xs">{t.location}</span> : null}
                </span>
              </figcaption>
            </li>
          ))}
        </ul>
      );
      break;
    case "marquee": {
      const row = (copy: number) =>
        items.map((t, i) => (
          <li key={`${copy}-${i}`} aria-hidden={copy > 0 || undefined} className="sf-quote-card mx-2 w-[20rem] shrink-0 whitespace-normal p-5 @[64rem]:w-[26rem]">
            <blockquote className="sf-heading text-lg leading-snug">“{t.quote}”</blockquote>
            <p className="sf-muted mt-3 text-xs uppercase tracking-[0.14em]">{who(t)}</p>
          </li>
        ));
      return (
        <section className={`sf-tone-${s.tone}`}>
          <div className="sf-container sf-section !pb-6">
            <Intro {...hp(s)} />
          </div>
          <div className="sf-marquee pb-14" style={{ ["--sf-marquee-duration" as string]: `${Math.max(30, items.length * 12)}s` }}>
            <ul className="sf-marquee-track">
              {row(0)}
              {row(1)}
            </ul>
          </div>
        </section>
      );
    }
    case "wall":
      body = (
        <ul className="columns-1 gap-5 @[48rem]:columns-2 @[64rem]:columns-3">
          {items.map((t, i) => (
            <li key={i} className="sf-quote-card mb-5 break-inside-avoid space-y-3 p-6">
              {t.rating ? <Stars rating={t.rating} small /> : null}
              <blockquote className={i % 3 === 0 ? "sf-heading text-2xl leading-snug" : "leading-relaxed"}>“{t.quote}”</blockquote>
              <p className="sf-muted text-sm">— {who(t)}</p>
            </li>
          ))}
        </ul>
      );
      break;
    default:
      return null;
  }
  return (
    <section className={`sf-tone-${s.tone}`}>
      <div className="sf-container sf-section">
        <Intro {...hp(s)} />
        {body}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Newsletter
// -----------------------------------------------------------------------------
export function NewsletterVariant({ s, ctx }: P<"Newsletter">) {
  const img = stockFor(ctx, s.imagePath, "story", 1);
  const text = (light = false) => (
    <div className="space-y-3">
      {s.eyebrow ? <p className={`sf-eyebrow ${light ? "!text-current opacity-80" : ""}`}>{s.eyebrow}</p> : null}
      <h2 className="sf-heading text-3xl @[64rem]:text-4xl">{s.heading}</h2>
      {s.subheading ? <p className={light ? "opacity-85" : "sf-muted"}>{s.subheading}</p> : null}
    </div>
  );
  switch (s.variant) {
    case "split":
      return (
        <section className={`sf-tone-${s.tone}`}>
          <div className="sf-container sf-section grid items-center gap-8 @[64rem]:grid-cols-2">
            {text()}
            <div className="sf-newsletter-left w-full">
              <NewsletterForm buttonLabel={s.buttonLabel} />
            </div>
          </div>
        </section>
      );
    case "banner":
      return (
        <section className="relative overflow-hidden">
          <StoreImage path={s.imagePath} alt={s.alt} sizes="100vw" stock={img} />
          <div aria-hidden className="absolute inset-0 bg-black/50" />
          <div className="sf-container sf-section relative mx-auto max-w-2xl space-y-6 text-center text-white">
            {text(true)}
            <div className="sf-newsletter-onphoto">
              <NewsletterForm buttonLabel={s.buttonLabel} />
            </div>
          </div>
          <PhotoCredit img={img} className="sf-photo-credit-on" />
        </section>
      );
    case "card":
      return (
        <section className="sf-container sf-section">
          <div className="relative grid overflow-hidden rounded-[calc(var(--sf-radius-card)+8px)] @[48rem]:grid-cols-[1.2fr_1fr]">
            <div className="relative min-h-56">
              <StoreImage path={s.imagePath} alt={s.alt} sizes="(min-width: 768px) 55vw, 100vw" stock={img} />
              <PhotoCredit img={img} className="sf-photo-credit-on" />
            </div>
            <div className={`sf-tone-${s.tone} flex flex-col justify-center gap-6 p-8 @[64rem]:p-12`}>
              {text()}
              <div className="sf-newsletter-left">
                <NewsletterForm buttonLabel={s.buttonLabel} />
              </div>
            </div>
          </div>
        </section>
      );
    case "inline":
      return (
        <section className={`sf-tone-${s.tone} border-y border-[var(--sf-border)]`}>
          <div className="sf-container flex flex-col gap-4 py-7 @[64rem]:flex-row @[64rem]:items-center @[64rem]:justify-between">
            <p className="sf-heading text-2xl">{s.heading}</p>
            <div className="sf-newsletter-left w-full @[64rem]:max-w-md">
              <NewsletterForm buttonLabel={s.buttonLabel} />
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}

