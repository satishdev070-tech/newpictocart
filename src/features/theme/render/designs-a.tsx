import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import type { SectionType } from "@/features/theme/sections/types";
import type { CategoryVariant, FooterLayout, HeroVariant, PromoVariant, SocialVariant } from "@/features/theme/sections/variants";
import { parseVideoUrl } from "@/features/theme/schema/primitives";
import { StoreArtImage, StoreImage, storeImageSrc } from "@/features/storefront/components/store-image";
import { HeroStage } from "@/features/storefront/components/hero-stage";
import { ReelVideo } from "@/features/storefront/components/reel-tile";
import { NewsletterForm } from "@/features/storefront/components/islands";
import { formatAddress, telHref, whatsappUrl } from "@/features/storefront/store-profile";
import type { MenuNode } from "@/features/storefront/urls";
import { toDescription } from "@/features/storefront/seo";
import { getInstagramFeed } from "@/features/social/server/instagram-feed";
import { assetUrl } from "@/lib/storage/assets";
import type { StockImage } from "@/lib/unsplash-stock";
import { Cta, HeadingText, headingClass } from "./parts";
import { SectionIntro, TextBox, hpLooks, lookOf, textBoxProps, textCurrentClass, type SectionIntroProps } from "./text-look";
import { slideGroups } from "./slide-visibility";
import { PhotoCredit, stockFor, type Tile } from "./variants";
import type { RenderContext } from "./context";

/**
 * Section designs, group a (sections/variants.ts): Hero slideshows, PromoBanner, CategoryGrid,
 * FAQ, Footer and Instagram (SocialProof) layouts. Server components; the only client islands are
 * the existing ones (newsletter form, reel video) and <HeroStage> for the fading slideshows. All
 * text is rendered as React text (escaped); classes come from fixed maps keyed by enum settings.
 */

type P<T extends SectionType> = { s: SectionSettings<T>; ctx: RenderContext };

const ALIGN_TEXT = { left: "text-left", center: "text-center", right: "text-right" } as const;
const ALIGN_ITEMS = { left: "items-start", center: "items-center", right: "items-end" } as const;
const ALIGN_SELF = { left: "", center: "mx-auto", right: "ml-auto" } as const;

// -----------------------------------------------------------------------------
// Hero slideshows
// -----------------------------------------------------------------------------
export const HERO_DESIGNS = ["hero-fade", "hero-slider", "hero-kenburns"] as const satisfies readonly HeroVariant[];
export type HeroDesignVariant = (typeof HERO_DESIGNS)[number];
export const isHeroDesign = (v: HeroVariant): v is HeroDesignVariant => (HERO_DESIGNS as readonly string[]).includes(v);

type Slide = SectionSettings<"Hero">["slides"][number];

const HERO_HEIGHT = { full: "min-h-[88svh]", large: "min-h-[78svh]", medium: "min-h-[60svh]", banner: "aspect-[4/5] @[48rem]:aspect-[2/1]" } as const;

function SlideMedia({ sl, stock, sizes, priority }: { sl: Slide; stock: StockImage | null; sizes: string; priority: boolean }) {
  if (!slideGroups(sl).media) return null;
  return sl.mobileImagePath ? (
    <StoreArtImage path={sl.imagePath} mobilePath={sl.mobileImagePath} alt={sl.alt} sizes={sizes} priority={priority} stock={stock} />
  ) : (
    <StoreImage path={sl.imagePath} alt={sl.alt} sizes={sizes} priority={priority} stock={stock} />
  );
}

function SlideText({ sl, first, light, itemIndex = 0 }: { sl: Slide; first: boolean; light: boolean; itemIndex?: number }) {
  const g = slideGroups(sl);
  const H = first ? "h1" : "h2";
  const cta = textBoxProps("cta", lookOf(sl.ctaLook), itemIndex);
  return (
    <div className="space-y-4">
      {g.subtitle && sl.eyebrow ? (
        <TextBox role="eyebrow" look={lookOf(sl.eyebrowLook)} itemIndex={itemIndex} as="p" className={`sf-eyebrow ${textCurrentClass(lookOf(sl.eyebrowLook))} opacity-85`}>
          {sl.eyebrow}
        </TextBox>
      ) : null}
      {g.title ? (
        <TextBox role="heading" look={lookOf(sl.headingLook)} itemIndex={itemIndex} as={H} className="sf-heading text-4xl @[64rem]:text-6xl">
          {sl.heading}
          {sl.headingAccent ? <em className="sf-hero-accent">{sl.headingAccent}</em> : null}
        </TextBox>
      ) : null}
      {g.description && sl.subheading ? (
        <TextBox role="subheading" look={lookOf(sl.subheadingLook)} itemIndex={itemIndex} as="p" className="max-w-xl text-lg opacity-90">
          {sl.subheading}
        </TextBox>
      ) : null}
      {g.actions ? <Cta label={sl.ctaLabel} href={sl.ctaHref} className={light ? "sf-btn sf-btn-light" : "sf-btn"} style={cta.style} dataAttrs={cta.attrs} /> : null}
    </div>
  );
}

const hasText = (sl: Slide) => {
  const g = slideGroups(sl);
  return Boolean((g.subtitle && sl.eyebrow) || (g.title && (sl.heading || sl.headingAccent)) || (g.description && sl.subheading) || (g.actions && sl.ctaLabel));
};

export function HeroDesign({ s, ctx, variant }: P<"Hero"> & { variant: HeroDesignVariant }) {
  const slides = s.slides;
  const stock = (i: number) => stockFor(ctx, slides[i]?.imagePath || slides[i]?.mobileImagePath, "hero", i);
  const names = slides.map((sl) => sl.heading || sl.alt);
  const thumbs =
    s.slideNav === "thumbs"
      ? slides.map((sl, i) => <StoreImage key={i} path={sl.imagePath || sl.mobileImagePath} alt="" sizes="96px" stock={stock(i)} />)
      : undefined;
  const autoplayMs = s.autoplay * 1000;

  if (variant === "hero-slider") {
    const reverse = slides[0]?.align === "right";
    const nodes = slides.map((sl, i) => (
      <div key={i} className={`grid @[48rem]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${reverse ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
        <div className={`flex flex-col justify-center px-6 py-10 @[48rem]:px-10 @[48rem]:pb-28 @[48rem]:pt-16 @[64rem]:px-16 ${ALIGN_TEXT[sl.align]}`}>
          <p aria-hidden className="sf-stage-count mb-6">
            {String(i + 1).padStart(2, "0")} <span className="opacity-50">/ {String(slides.length).padStart(2, "0")}</span>
          </p>
          <div className={`max-w-lg ${ALIGN_SELF[sl.align]}`}>
            <SlideText sl={sl} first={i === 0} light={false} itemIndex={i} />
          </div>
        </div>
        <div className={`relative overflow-hidden ${s.mediaRatio === "auto" ? "aspect-[4/5] @[48rem]:aspect-auto @[48rem]:min-h-[72svh]" : s.mediaRatio === "portrait" ? "aspect-[4/5]" : s.mediaRatio === "square" ? "aspect-square" : "aspect-[4/3]"}`}>
          <SlideMedia sl={sl} stock={stock(i)} sizes="(min-width: 768px) 58vw, 100vw" priority={i === 0} />
          <PhotoCredit img={stock(i)} className="sf-photo-credit-on" />
        </div>
      </div>
    ));
    return (
      <section className={`sf-tone-${s.panelTone}`}>
        <HeroStage label="Featured" slides={nodes} names={names} thumbs={thumbs} nav={s.slideNav} autoplayMs={autoplayMs} placement="panel" className={reverse ? "sf-stage-panel-end" : ""} />
      </section>
    );
  }

  const kenburns = variant === "hero-kenburns";
  const nodes = slides.map((sl, i) => {
    const light = sl.textTone === "light";
    const media = <SlideMedia sl={sl} stock={stock(i)} sizes="100vw" priority={i === 0} />;
    if (!hasText(sl)) {
      return (
        <div key={i} className={`relative w-full overflow-hidden ${HERO_HEIGHT[s.height]}`}>
          {sl.ctaHref ? (
            <Link href={sl.ctaHref} aria-label={sl.alt || "Open"} className="absolute inset-0">
              {media}
            </Link>
          ) : (
            media
          )}
          <PhotoCredit img={stock(i)} className="sf-photo-credit-on" />
        </div>
      );
    }
    return (
      <div key={i} className={`relative flex w-full overflow-hidden ${HERO_HEIGHT[s.height]} ${kenburns ? "items-center" : "items-end"}`}>
        {media}
        <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: s.overlay / 100 }} />
        <div className={`sf-container relative py-16 ${kenburns ? "" : "pb-24"} ${ALIGN_TEXT[sl.align]}`}>
          {kenburns ? (
            <div className={`sf-stage-card max-w-xl p-6 @[48rem]:p-10 ${ALIGN_SELF[sl.align]} ${light ? "sf-stage-card-dark text-white" : "sf-stage-card-light"}`}>
              <SlideText sl={sl} first={i === 0} light={light} itemIndex={i} />
            </div>
          ) : (
            <div className={`max-w-xl ${ALIGN_SELF[sl.align]} ${light ? "text-white" : ""}`}>
              <SlideText sl={sl} first={i === 0} light={light} itemIndex={i} />
            </div>
          )}
        </div>
        <PhotoCredit img={stock(i)} className="sf-photo-credit-on" />
      </div>
    );
  });
  return (
    <section>
      <HeroStage
        label="Featured"
        slides={nodes}
        names={names}
        thumbs={thumbs}
        nav={s.slideNav}
        autoplayMs={autoplayMs}
        placement={s.slideNav === "thumbs" && !kenburns ? "below" : "overlay"}
        className={kenburns ? "sf-stage-kenburns" : "sf-stage-fade"}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Promo banner
// -----------------------------------------------------------------------------
type PromoTile = SectionSettings<"PromoBanner">["tiles"][number];
const tileHasText = (t: PromoTile) => Boolean(t.heading || t.text || t.ctaLabel);

function Badge({ text, className = "" }: { text: string; className?: string }) {
  return text ? <span className={`sf-promo-badge ${className}`}>{text}</span> : null;
}

function PromoCopy({ t, badge, light, big = false, itemIndex }: { t: PromoTile; badge: string; light: boolean; big?: boolean; itemIndex?: number }) {
  const cta = textBoxProps("cta", lookOf(t.ctaLook), itemIndex);
  return (
    <>
      <Badge text={badge} />
      {t.heading ? <h2 className={`sf-heading ${big ? "text-4xl @[64rem]:text-6xl" : "text-3xl @[64rem]:text-4xl"}`}>{t.heading}</h2> : null}
      {t.text ? <p className="max-w-xl text-base opacity-90 @[64rem]:text-lg">{t.text}</p> : null}
      <Cta label={t.ctaLabel} href={t.ctaHref} className={light ? "sf-btn sf-btn-light" : "sf-btn"} style={cta.style} dataAttrs={cta.attrs} />
    </>
  );
}

/** Whole-tile link for an image-only tile (text designed into the image). */
function TileLink({ t }: { t: PromoTile }) {
  return t.ctaHref ? <Link href={t.ctaHref} aria-label={t.alt || t.heading || "Open"} className="absolute inset-0 z-[1]" /> : null;
}

export function PromoDesign({ s, ctx, variant }: P<"PromoBanner"> & { variant: Exclude<PromoVariant, "tiles"> }) {
  const tone = `sf-tone-${s.tone}`;
  const stock = (t: PromoTile, i: number) => stockFor(ctx, t.imagePath, "tiles", i);
  const flip = s.align === "right";

  switch (variant) {
    case "promo-fullwidth":
      return (
        <section className="sf-section space-y-4">
          {s.tiles.map((t, i) => (
            <div key={i} className="relative flex aspect-[4/5] w-full items-center overflow-hidden @[48rem]:aspect-[21/8]">
              <StoreImage path={t.imagePath} alt={t.alt} sizes="100vw" stock={stock(t, i)} />
              {tileHasText(t) ? (
                <>
                  <div aria-hidden className={`absolute inset-0 ${s.align === "center" ? "bg-black/40" : s.align === "right" ? "bg-gradient-to-l from-black/65 to-transparent" : "bg-gradient-to-r from-black/65 to-transparent"}`} />
                  <div className={`sf-container relative flex flex-col gap-4 py-12 text-white ${ALIGN_TEXT[s.align]} ${ALIGN_ITEMS[s.align]}`}>
                    <PromoCopy t={t} badge={s.badge} light big itemIndex={i} />
                  </div>
                </>
              ) : (
                <TileLink t={t} />
              )}
              <PhotoCredit img={stock(t, i)} className="sf-photo-credit-on" />
            </div>
          ))}
        </section>
      );
    case "promo-split":
      return (
        <section className="sf-container sf-section space-y-4">
          {s.tiles.map((t, i) => (
            <div key={i} className={`grid overflow-hidden rounded-[var(--sf-radius-card)] @[48rem]:grid-cols-2 ${tone} ${flip || i % 2 === 1 ? "@[48rem]:[&>*:first-child]:order-2" : ""}`}>
              <div className="relative aspect-[4/3] @[48rem]:aspect-auto @[48rem]:min-h-[22rem]">
                <StoreImage path={t.imagePath} alt={t.alt} sizes="(min-width: 768px) 50vw, 100vw" stock={stock(t, i)} />
                <PhotoCredit img={stock(t, i)} className="sf-photo-credit-on" />
              </div>
              <div className={`flex flex-col justify-center gap-4 p-8 @[64rem]:p-14 ${ALIGN_TEXT[s.align]} ${ALIGN_ITEMS[s.align]}`}>
                <PromoCopy t={t} badge={i === 0 ? s.badge : ""} light={false} itemIndex={i} />
              </div>
            </div>
          ))}
        </section>
      );
    case "promo-mosaic": {
      const tiles = s.tiles.slice(0, 3);
      return (
        <section className="sf-container sf-section">
          <ul className={`grid gap-3 @[48rem]:gap-4 ${tiles.length === 3 ? "@[48rem]:grid-cols-[3fr_2fr] @[48rem]:grid-rows-2" : tiles.length === 2 ? "@[48rem]:grid-cols-[3fr_2fr]" : ""}`}>
            {tiles.map((t, i) => (
              <li key={i} className={`relative overflow-hidden rounded-[var(--sf-radius-card)] ${i === 0 ? `aspect-[4/5] @[48rem]:aspect-auto @[48rem]:min-h-[26rem] ${tiles.length === 3 ? "@[48rem]:row-span-2" : ""}` : "aspect-[16/10] @[48rem]:aspect-auto @[48rem]:min-h-[12rem]"}`}>
                <StoreImage path={t.imagePath} alt={t.alt} sizes={i === 0 ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 768px) 40vw, 100vw"} stock={stock(t, i)} className="transition duration-700 hover:scale-105" />
                {tileHasText(t) ? (
                  <div className={`absolute inset-0 flex flex-col justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-6 text-white ${ALIGN_TEXT[s.align]} ${ALIGN_ITEMS[s.align]}`}>
                    {i === 0 ? <Badge text={s.badge} /> : null}
                    {t.heading ? <h2 className={`sf-heading ${i === 0 ? "text-3xl @[64rem]:text-5xl" : "text-2xl"}`}>{t.heading}</h2> : null}
                    {t.text ? <p className="text-sm opacity-90">{t.text}</p> : null}
                    <div className="mt-1">
                      <Cta
                        label={t.ctaLabel}
                        href={t.ctaHref}
                        className="sf-btn sf-btn-light"
                        style={textBoxProps("cta", lookOf(t.ctaLook), i).style}
                        dataAttrs={textBoxProps("cta", lookOf(t.ctaLook), i).attrs}
                      />
                    </div>
                  </div>
                ) : (
                  <TileLink t={t} />
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "promo-overlap":
      return (
        <section className="sf-container sf-section space-y-10">
          {s.tiles.map((t, i) => {
            const right = flip !== (i % 2 === 1);
            return (
              <div key={i} className="relative @[64rem]:py-10">
                <div className={`relative aspect-[4/3] overflow-hidden rounded-[var(--sf-radius-card)] @[48rem]:aspect-[16/9] @[64rem]:w-[68%] ${right ? "@[64rem]:ml-auto" : ""}`}>
                  <StoreImage path={t.imagePath} alt={t.alt} sizes="(min-width: 1024px) 68vw, 100vw" stock={stock(t, i)} />
                  <PhotoCredit img={stock(t, i)} className="sf-photo-credit-on" />
                </div>
                <div
                  className={`sf-promo-card relative mx-4 -mt-14 flex flex-col gap-4 p-7 @[64rem]:absolute @[64rem]:top-1/2 @[64rem]:mx-0 @[64rem]:mt-0 @[64rem]:w-[42%] @[64rem]:-translate-y-1/2 @[64rem]:p-12 ${right ? "@[64rem]:left-0" : "@[64rem]:right-0"} ${tone} ${ALIGN_TEXT[s.align]} ${ALIGN_ITEMS[s.align]}`}
                >
                  <PromoCopy t={t} badge={i === 0 ? s.badge : ""} light={false} itemIndex={i} />
                </div>
              </div>
            );
          })}
        </section>
      );
    case "promo-strip":
      return (
        <section className={tone}>
          <ul className={`sf-container grid divide-y divide-[var(--sf-border)] @[64rem]:divide-x @[64rem]:divide-y-0 ${s.tiles.length === 3 ? "@[64rem]:grid-cols-3" : s.tiles.length === 2 ? "@[64rem]:grid-cols-2" : ""}`}>
            {s.tiles.map((t, i) => {
              const img = assetUrl(t.imagePath);
              const cta = textBoxProps("cta", lookOf(t.ctaLook), i);
              return (
                <li key={i} className={`flex flex-wrap items-center gap-x-5 gap-y-3 py-5 @[64rem]:px-6 @[64rem]:first:pl-0 @[64rem]:last:pr-0 ${s.tiles.length === 1 ? "@[48rem]:flex-nowrap" : ""} ${s.align === "center" ? "justify-center text-center" : s.align === "right" ? "justify-end text-right" : ""}`}>
                  {i === 0 && s.badge ? <span className="sf-promo-strip-badge sf-heading">{s.badge}</span> : null}
                  {img ? (
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-full">
                      <StoreImage path={t.imagePath} alt={t.alt} sizes="96px" />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 basis-48">
                    {t.heading ? <span className="sf-heading block text-xl @[64rem]:text-2xl">{t.heading}</span> : null}
                    {t.text ? <span className="block text-sm opacity-85">{t.text}</span> : null}
                  </span>
                  <Cta label={t.ctaLabel} href={t.ctaHref} className="sf-btn shrink-0" style={cta.style} dataAttrs={cta.attrs} />
                </li>
              );
            })}
          </ul>
        </section>
      );
    case "promo-minimal":
      return (
        <section className={tone}>
          <div className={`sf-container sf-section grid gap-12 ${s.tiles.length === 3 ? "@[64rem]:grid-cols-3" : s.tiles.length === 2 ? "@[48rem]:grid-cols-2" : ""}`}>
            {s.tiles.map((t, i) => (
              <div key={i} className={`flex flex-col gap-5 ${s.tiles.length === 1 ? `max-w-3xl ${ALIGN_SELF[s.align]}` : ""} ${ALIGN_TEXT[s.align]} ${ALIGN_ITEMS[s.align]}`}>
                <PromoCopy t={t} badge={i === 0 ? s.badge : ""} light={false} big={s.tiles.length === 1} itemIndex={i} />
              </div>
            ))}
          </div>
        </section>
      );
  }
}

// -----------------------------------------------------------------------------
// Category tiles
// -----------------------------------------------------------------------------
export const CATEGORY_DESIGNS = ["cat-circles", "cat-overlay", "cat-bento", "cat-banners"] as const satisfies readonly CategoryVariant[];
export type CategoryDesignVariant = (typeof CATEGORY_DESIGNS)[number];
export const isCategoryDesign = (v: CategoryVariant): v is CategoryDesignVariant => (CATEGORY_DESIGNS as readonly string[]).includes(v);

/** Bento pattern (4 columns on desktop, 2 on phones; grid-flow-dense closes gaps). */
const BENTO = ["col-span-2 row-span-2", "col-span-2", "", "", "row-span-2", "col-span-2"];
const OVERLAY_COLS: Record<number, string> = { 1: "", 2: "@[48rem]:grid-cols-2", 3: "@[48rem]:grid-cols-3", 4: "@[48rem]:grid-cols-4" };

export function CategoryDesign({ tiles, variant, intro, ctx }: { tiles: Tile[]; variant: CategoryDesignVariant; intro: SectionIntroProps; ctx: RenderContext }) {
  const stockAt = (t: Tile, i: number) => stockFor(ctx, t.imagePath, "tiles", i);
  let body: ReactNode;
  switch (variant) {
    case "cat-circles":
      body = (
        <ul className="sf-scroll-row -mx-4 gap-4 px-4 @[48rem]:mx-0 @[48rem]:flex-wrap @[48rem]:justify-center @[48rem]:gap-x-8 @[48rem]:gap-y-6 @[48rem]:overflow-visible @[48rem]:px-0">
          {tiles.map((t, i) => (
            <li key={t.href} className="w-[27%] max-w-[8.5rem] @[48rem]:w-[8.5rem] @[64rem]:w-[9.5rem] @[64rem]:max-w-none">
              <Link href={t.href} className="sf-cat-circle group block text-center">
                <span className="relative block aspect-square overflow-hidden rounded-full">
                  <StoreImage path={t.imagePath} alt="" sizes="(min-width: 1024px) 152px, 30vw" stock={stockAt(t, i)} className="transition duration-500 group-hover:scale-110" />
                </span>
                <span className="mt-3 block text-sm font-medium leading-tight @[64rem]:text-base">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "cat-overlay":
      body = (
        <ul className={`grid grid-cols-2 gap-3 @[64rem]:gap-5 ${OVERLAY_COLS[Math.min(tiles.length, 4)] ?? OVERLAY_COLS[4]}`}>
          {tiles.map((t, i) => (
            <li key={t.href}>
              <Link href={t.href} className="group relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[var(--sf-radius-card)] text-center text-white">
                <StoreImage path={t.imagePath} alt="" sizes="(min-width: 1024px) 25vw, 50vw" stock={stockAt(t, i)} className="transition duration-700 group-hover:scale-105" />
                <span aria-hidden className="absolute inset-0 bg-black/35 transition group-hover:bg-black/50" />
                <span className="relative px-3">
                  <span className="sf-heading block text-2xl drop-shadow @[64rem]:text-3xl">{t.label}</span>
                  <span className="mt-2 inline-block border-b border-current pb-0.5 text-[0.7rem] uppercase tracking-[0.2em] opacity-90">Shop now</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "cat-bento":
      body = (
        <ul className="grid auto-rows-[9rem] grid-flow-dense grid-cols-2 gap-3 @[48rem]:auto-rows-[11rem] @[64rem]:auto-rows-[13rem] @[64rem]:grid-cols-4 @[64rem]:gap-4">
          {tiles.map((t, i) => (
            <li key={t.href} className={BENTO[i % BENTO.length]}>
              <Link href={t.href} className="group relative block h-full overflow-hidden rounded-[var(--sf-radius-card)]">
                <StoreImage path={t.imagePath} alt="" sizes={i % BENTO.length === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} stock={stockAt(t, i)} className="transition duration-700 group-hover:scale-105" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white @[64rem]:p-5">
                  <span className={`sf-heading ${i % BENTO.length === 0 ? "text-3xl @[64rem]:text-4xl" : "text-xl"}`}>{t.label}</span>
                  <span aria-hidden className="sf-cat-arrow">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "cat-banners":
      body = (
        <ol className="grid gap-3 @[64rem]:grid-cols-2 @[64rem]:gap-4">
          {tiles.map((t, i) => (
            <li key={t.href}>
              <Link href={t.href} className="sf-cat-banner group grid grid-cols-[2rem_minmax(0,1fr)_5.5rem] items-center gap-3 p-3 @[48rem]:grid-cols-[3rem_minmax(0,1fr)_9rem] @[48rem]:gap-5 @[48rem]:p-4">
                <span className="sf-muted text-sm tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="sf-heading block truncate text-xl transition group-hover:translate-x-1 @[48rem]:text-2xl">{t.label}</span>
                  {t.subtitle ? <span className="sf-muted mt-1 line-clamp-2 block text-sm">{t.subtitle}</span> : <span className="sf-muted mt-1 block text-xs uppercase tracking-[0.16em]">Explore →</span>}
                </span>
                <span className="relative block aspect-[4/3] overflow-hidden rounded-[calc(var(--sf-radius-card)*0.75)]">
                  <StoreImage path={t.imagePath} alt="" sizes="144px" stock={stockAt(t, i)} className="transition duration-500 group-hover:scale-105" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      );
      break;
  }
  return (
    <section className="sf-container sf-section">
      <SectionIntro {...intro} />
      {body}
    </section>
  );
}

/** Short plain-text subtitle for a banner row (category description). */
export const tileSubtitle = (text: string | null | undefined) => toDescription(text, 110);

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------
type FaqItem = { question: string; answer: string };

function Accordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="sf-border divide-y divide-[var(--sf-border)] border-y">
      {items.map((f, i) => (
        <details key={i} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {f.question}
            <span aria-hidden className="transition group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="sf-muted mt-3 whitespace-pre-line text-sm leading-relaxed">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

function FaqHeading({ s, centred = false }: { s: SectionSettings<"FAQ">; centred?: boolean }) {
  if (!s.eyebrow && !s.heading && !s.subheading) return null;
  return (
    <div className={`space-y-3 ${centred ? "mx-auto max-w-2xl text-center" : ""}`}>
      {s.eyebrow ? (
        <TextBox role="eyebrow" look={lookOf(s.eyebrowLook)} as="p" className="sf-eyebrow">
          {s.eyebrow}
        </TextBox>
      ) : null}
      {s.heading ? (
        <TextBox role="heading" look={lookOf(s.headingLook)} as="h2" className={headingClass(s.headingStyle, "sf-heading text-3xl @[64rem]:text-5xl")}>
          <HeadingText heading={s.heading} accent={s.headingAccent} />
        </TextBox>
      ) : null}
      {s.subheading ? (
        <TextBox role="subheading" look={lookOf(s.subheadingLook)} as="p" className="sf-muted">
          {s.subheading}
        </TextBox>
      ) : null}
    </div>
  );
}

export function FaqDesign({ s, items }: { s: SectionSettings<"FAQ">; items: FaqItem[] }) {
  const ctaLook = textBoxProps("cta", lookOf(s.ctaLook));
  const cta = <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn sf-btn-outline" style={ctaLook.style} dataAttrs={ctaLook.attrs} />;
  switch (s.variant) {
    case "faq-split":
      return (
        <section className="sf-container sf-section grid gap-10 @[64rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @[64rem]:gap-16">
          <div className="space-y-6 @[64rem]:sticky @[64rem]:top-24 @[64rem]:self-start">
            <FaqHeading s={s} />
            {cta}
          </div>
          <Accordion items={items} />
        </section>
      );
    case "faq-cards":
      return (
        <section className="sf-container sf-section">
          <SectionIntro {...hpLooks(s)} />
          <dl className="grid gap-4 @[48rem]:grid-cols-2 @[64rem]:grid-cols-3">
            {items.map((f, i) => (
              <div key={i} className="sf-faq-card p-6">
                <dt className="sf-heading text-lg leading-snug">{f.question}</dt>
                <dd className="sf-muted mt-3 whitespace-pre-line text-sm leading-relaxed">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case "faq-numbered":
      return (
        <section className="sf-container sf-section mx-auto max-w-3xl">
          <FaqHeading s={s} centred />
          <ol className="mt-10 space-y-8">
            {items.map((f, i) => (
              <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 @[48rem]:grid-cols-[3.5rem_minmax(0,1fr)]">
                <span aria-hidden className="sf-faq-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-medium leading-snug">{f.question}</h3>
                  <p className="sf-muted mt-2 whitespace-pre-line text-sm leading-relaxed">{f.answer}</p>
                </div>
              </li>
            ))}
          </ol>
          {s.ctaLabel && s.ctaHref ? <div className="mt-10 text-center">{cta}</div> : null}
        </section>
      );
    case "faq-chat":
      return (
        <section className="sf-container sf-section mx-auto max-w-2xl">
          <FaqHeading s={s} centred />
          <dl className="mt-10 space-y-5">
            {items.map((f, i) => (
              <div key={i} className="space-y-2">
                <dt className="sf-faq-bubble sf-faq-q">
                  <span className="sr-only">Question: </span>
                  {f.question}
                </dt>
                <dd className="sf-faq-bubble sf-faq-a whitespace-pre-line">
                  <span className="sr-only">Answer: </span>
                  {f.answer}
                </dd>
              </div>
            ))}
          </dl>
          {s.ctaLabel && s.ctaHref ? (
            <div className="mt-8 flex justify-end">
              <Cta label={s.ctaLabel} href={s.ctaHref} className="sf-btn" style={ctaLook.style} dataAttrs={ctaLook.attrs} />
            </div>
          ) : null}
        </section>
      );
    default:
      return (
        <section className="sf-container sf-section mx-auto max-w-3xl">
          <SectionIntro {...hpLooks(s)} />
          <Accordion items={items} />
        </section>
      );
  }
}

// -----------------------------------------------------------------------------
// Instagram / social
// -----------------------------------------------------------------------------
type IgPost = { path: string; remote: string | null; alt: string; href: string; reel: string | null; poster: string | null; video: boolean };

function IgMedia({ p, sizes }: { p: IgPost; sizes: string }) {
  return (
    <>
      {p.remote ? (
        // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN image (validated host), not a store asset
        <img src={p.remote} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <StoreImage path={p.path} alt={p.alt} sizes={sizes} />
      )}
      {p.reel ? <ReelVideo src={p.reel} poster={p.poster} /> : null}
    </>
  );
}

function ReelIcon() {
  return (
    <span aria-hidden className="absolute right-2 top-2 text-white drop-shadow">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="m10 9 5 3-5 3z" fill="currentColor" />
      </svg>
    </span>
  );
}

function IgAvatar({ ctx, size }: { ctx: RenderContext; size: "md" | "lg" }) {
  const logo = storeImageSrc(ctx.sf.theme.header.logoPath || ctx.sf.store.logoPath);
  const cls = size === "lg" ? "size-20 @[48rem]:size-28" : "size-14";
  return (
    <span className="sf-ig-ring shrink-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar
        <img src={logo} alt="" className={`${cls} rounded-full bg-white object-contain p-1`} />
      ) : (
        <span className={`sf-heading grid ${cls} place-items-center rounded-full bg-[var(--sf-bg)] text-xl`}>{ctx.sf.store.name.charAt(0)}</span>
      )}
    </span>
  );
}

/** Instagram section: the posts added in the editor, or the connected account's latest posts. */
export async function SocialProofSection({ s, ctx }: P<"SocialProof">) {
  const feed = s.source === "instagram" ? await getInstagramFeed(ctx.sf.tenant.tenantId) : null;
  const live = Boolean(feed?.media.length);
  const posts: IgPost[] = live
    ? feed!.media.map((m) => ({ path: "", remote: m.imageUrl, alt: m.caption || "Instagram post", href: m.permalink, reel: null, poster: null, video: m.isVideo }))
    : s.posts.map((p) => {
        const v = p.videoUrl ? parseVideoUrl(p.videoUrl) : null;
        const reel = v?.provider === "file" ? assetUrl(v.path) : null;
        return { path: p.imagePath, remote: null, alt: p.alt, href: p.href, reel, poster: assetUrl(p.imagePath), video: Boolean(reel) };
      });
  if (!posts.length) return null;
  const rawHandle = s.handle || (live ? (feed!.username ?? "") : "");
  const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`) : "";
  const profileUrl = s.profileUrl || (live && feed!.username ? `https://www.instagram.com/${feed!.username.slice(1)}/` : "");
  const layout: SocialVariant = s.layout;
  const greyscale = s.filter === "greyscale" ? "sf-greyscale " : "";

  const linked = (p: IgPost, tile: ReactNode, className = "block h-full") =>
    p.href || profileUrl ? (
      <a href={p.href || profileUrl} rel="noopener noreferrer" target="_blank" aria-label={p.alt || (p.video ? "Watch reel" : "Open post")} className={className}>
        {tile}
      </a>
    ) : (
      tile
    );

  const follow = profileUrl ? (
    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="sf-ig-follow">
      Follow
    </a>
  ) : null;

  const profileRow =
    s.showProfile && (handle || profileUrl) ? (
      <div className="sf-ig-profile mx-auto mb-8 flex max-w-md items-center gap-4">
        <IgAvatar ctx={ctx} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{handle || ctx.sf.store.name}</span>
          <span className="sf-muted block truncate text-xs">{ctx.sf.store.name} · Instagram</span>
        </span>
        {follow}
      </div>
    ) : null;

  if (layout === "ig-profile") {
    const shown = posts.slice(0, 9);
    return (
      <section className="sf-container sf-section mx-auto max-w-4xl">
        <SectionIntro {...hpLooks(s)} />
        <div className="mb-6 flex items-center gap-5 @[48rem]:gap-10 @[48rem]:px-6">
          <IgAvatar ctx={ctx} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="truncate text-lg font-semibold @[48rem]:text-xl">{handle || ctx.sf.store.name}</span>
              {follow}
            </div>
            <p className="text-sm">
              <span className="font-semibold">{ctx.sf.store.name}</span>
              <span className="sf-muted"> · Instagram</span>
            </p>
            {s.bio ? <p className="sf-muted max-w-md text-sm">{s.bio}</p> : null}
          </div>
        </div>
        <ul className={`${greyscale}grid grid-cols-3 gap-1 border-t border-[var(--sf-border)] pt-1`}>
          {shown.map((p, i) => (
            <li key={i}>
              {linked(
                p,
                <div className="sf-ig-tile group relative aspect-square overflow-hidden">
                  <IgMedia p={p} sizes="(min-width: 1024px) 300px, 33vw" />
                  <span aria-hidden className="sf-ig-overlay">
                    {p.video ? "▶ Reel" : "View post"}
                  </span>
                  {p.video ? <ReelIcon /> : null}
                </div>,
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (layout === "ig-reels") {
    return (
      <section className="sf-container sf-section">
        <SectionIntro {...hpLooks(s)} />
        {profileRow}
        <ul className={`${greyscale}sf-scroll-row -mx-4 px-4 @[48rem]:mx-0 @[48rem]:px-0`} aria-label="Instagram reels">
          {posts.map((p, i) => (
            <li key={i} className="w-[62%] @[48rem]:w-[31%] @[64rem]:w-[19%]">
              {linked(
                p,
                <div className="sf-ig-tile sf-ig-reel group relative aspect-[9/16] overflow-hidden rounded-[calc(var(--sf-radius-card)+6px)]">
                  <IgMedia p={p} sizes="(min-width: 1024px) 20vw, 62vw" />
                  <span aria-hidden className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-xs font-medium text-white">
                    {handle || ctx.sf.store.name}
                  </span>
                  {p.video ? <ReelIcon /> : null}
                </div>,
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (layout === "ig-collage") {
    const shown = posts.slice(0, 6);
    const card = (
      <li key="follow" className="sf-ig-follow-card col-span-2 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <IgAvatar ctx={ctx} size="md" />
        <p className="sf-heading text-2xl">{handle || ctx.sf.store.name}</p>
        <p className="sf-muted text-sm">Follow us on Instagram for new arrivals and behind the scenes.</p>
        {follow}
      </li>
    );
    const tiles = shown.map((p, i) => (
      <li key={i} className="sf-ig-collage-item">
        {linked(
          p,
          <div className={`sf-ig-tile group relative overflow-hidden rounded-[var(--sf-radius-card)] ${i % 3 === 0 ? "aspect-[4/5]" : "aspect-square"}`}>
            <IgMedia p={p} sizes="(min-width: 768px) 25vw, 50vw" />
            <span aria-hidden className="sf-ig-overlay">
              {p.video ? "▶ Reel" : "View post"}
            </span>
            {p.video ? <ReelIcon /> : null}
          </div>,
        )}
      </li>
    ));
    return (
      <section className="sf-container sf-section">
        <SectionIntro {...hpLooks(s)} />
        <ul className={`${greyscale}sf-ig-collage grid grid-cols-2 items-start gap-3 @[48rem]:grid-cols-4 @[48rem]:gap-4`}>
          {[...tiles.slice(0, 1), card, ...tiles.slice(1)]}
        </ul>
      </section>
    );
  }

  // grid / mosaic / strip: the original layouts.
  const mosaic = layout === "mosaic";
  const strip = layout === "strip";
  // A mosaic only fills evenly with 1 large + 4 or 1 large + 8 tiles.
  const shown = mosaic ? posts.slice(0, posts.length >= 9 ? 9 : posts.length >= 5 ? 5 : posts.length) : posts;
  return (
    <section className="sf-container sf-section">
      <SectionIntro {...hpLooks(s)} />
      {profileRow}
      <ul className={`${greyscale}${strip ? "sf-reel-strip" : `grid gap-2 @[48rem]:gap-3 ${mosaic ? "grid-cols-2 @[48rem]:grid-cols-4" : "grid-cols-3 @[64rem]:grid-cols-6"}`}`}>
        {shown.map((p, i) => {
          const big = mosaic && i === 0;
          const tile = (
            <div className={`sf-ig-tile group relative overflow-hidden ${big ? "aspect-square @[48rem]:aspect-auto @[48rem]:h-full" : strip ? "aspect-[3/4] @[64rem]:aspect-[9/10]" : p.reel ? "aspect-[9/16] @[48rem]:aspect-square" : "aspect-square"}`}>
              <IgMedia p={p} sizes={big ? "(min-width: 768px) 50vw, 50vw" : "(min-width: 1024px) 16vw, 33vw"} />
              <span aria-hidden className="sf-ig-overlay">
                {p.video ? "▶ Reel" : "View post"}
              </span>
              {p.video ? <ReelIcon /> : null}
            </div>
          );
          return (
            <li key={i} className={big ? "col-span-2 row-span-2" : ""}>
              {linked(p, tile)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Footer
// -----------------------------------------------------------------------------
export const FOOTER_DESIGNS = ["footer-mega", "footer-brand", "footer-app", "footer-illustrated", "footer-tworow"] as const satisfies readonly FooterLayout[];
export type FooterDesignLayout = (typeof FOOTER_DESIGNS)[number];
export const isFooterDesign = (v: FooterLayout): v is FooterDesignLayout => (FOOTER_DESIGNS as readonly string[]).includes(v);

type FooterProps = { s: SectionSettings<"Footer">; ctx: RenderContext };

function FooterLink({ node }: { node: MenuNode }) {
  if (!node.href) return <span className="sf-footer-link">{node.title}</span>;
  return node.external ? (
    <a href={node.href} className="sf-footer-link" rel="noopener noreferrer" target="_blank">
      {node.title}
    </a>
  ) : (
    <Link href={node.href} className="sf-footer-link">
      {node.title}
    </Link>
  );
}

function FooterMenus({ s, ctx, className = "" }: FooterProps & { className?: string }) {
  return (
    <>
      {s.menuHandles.map((handle) => {
        const menu = ctx.menus[handle];
        if (!menu?.items.length) return null;
        return (
          <nav key={handle} aria-label={menu.title} className={className}>
            <p className="sf-footer-title">{menu.title}</p>
            <ul className="space-y-2.5 text-sm">
              {menu.items.map((n) => (
                <li key={n.id}>
                  <FooterLink node={n} />
                </li>
              ))}
            </ul>
          </nav>
        );
      })}
    </>
  );
}

function FooterSocial({ s, ctx, className = "" }: FooterProps & { className?: string }) {
  const social = ctx.sf.store.social;
  if (!s.showSocial || !social.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {social.map((l) => (
        <li key={l.url}>
          <a href={l.url} rel="noopener noreferrer" target="_blank" className="sf-footer-social">
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function FooterContact({ s, ctx, title = "Get in touch" }: FooterProps & { title?: string }) {
  if (!s.showContact) return null;
  const store = ctx.sf.store;
  const address = formatAddress(store.address);
  const wa = whatsappUrl(store.whatsapp);
  const tel = telHref(store.phone);
  return (
    <div className="space-y-2.5 text-sm">
      <p className="sf-footer-title">{title}</p>
      {store.email ? (
        <p>
          <a href={`mailto:${store.email}`} className="sf-footer-link break-all">
            {store.email}
          </a>
        </p>
      ) : null}
      {store.phone && tel ? (
        <p>
          <a href={tel} className="sf-footer-link">
            {store.phone}
          </a>
        </p>
      ) : null}
      {wa ? (
        <p>
          <a href={wa} rel="noopener noreferrer" target="_blank" className="sf-footer-link">
            WhatsApp us
          </a>
        </p>
      ) : null}
      {address.length ? <address className="not-italic opacity-75">{address.join(", ")}</address> : null}
    </div>
  );
}

function About({ s, ctx, className = "max-w-sm" }: FooterProps & { className?: string }) {
  const text = s.about || ctx.sf.store.tagline;
  return text ? <p className={`text-sm leading-relaxed opacity-80 ${className}`}>{text}</p> : null;
}

/** Generic line drawing (hills, sun, birds) used when the Illustrated footer has no uploaded artwork. */
function DefaultArt() {
  return (
    <svg aria-hidden className="sf-footer-art-default" viewBox="0 0 1200 160" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        <circle cx="930" cy="58" r="26" opacity="0.35" />
        <path d="M0 160V112C120 72 220 70 330 98S540 140 660 108 880 52 1010 74 1150 118 1200 104V160Z" opacity="0.22" />
        <path d="M0 160V128C150 104 260 112 380 128S620 150 760 126 1020 98 1200 124V160Z" opacity="0.4" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <path d="M250 50q8-8 16 0q8-8 16 0" />
        <path d="M300 36q6-6 12 0q6-6 12 0" />
        <path d="M720 44q7-7 14 0q7-7 14 0" />
      </g>
    </svg>
  );
}

/** The seller's illustration across the footer (Illustrated layout / "My illustration" decoration). */
export function FooterIllustration({ s, fallback = false }: { s: SectionSettings<"Footer">; fallback?: boolean }) {
  if (!assetUrl(s.imagePath)) return fallback ? <DefaultArt /> : null;
  return (
    <div className="sf-footer-art relative mx-auto w-full max-w-6xl px-4">
      <StoreImage path={s.imagePath} alt={s.imageAlt} sizes="(min-width: 1152px) 1152px, 100vw" natural />
    </div>
  );
}

function ContactIcon({ kind }: { kind: "wa" | "call" | "mail" | "map" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "wa" ? <path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.6L3 21zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2L9 9.5z" /> : null}
      {kind === "call" ? <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /> : null}
      {kind === "mail" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      ) : null}
      {kind === "map" ? (
        <>
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </>
      ) : null}
    </svg>
  );
}

/** Body of the group-a footer layouts; the <Footer> wrapper adds tone, decoration and the bottom bar. */
export function FooterBody({ s, ctx, payments }: FooterProps & { payments: string[] }) {
  const store = ctx.sf.store;
  const layout = s.layout as FooterDesignLayout;
  switch (layout) {
    case "footer-mega":
      return (
        <div className="sf-container relative py-12 @[64rem]:py-16">
          <div className="sf-footer-panel grid gap-6 p-6 @[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] @[64rem]:items-center @[64rem]:p-10">
            <div className="space-y-2">
              <p className="sf-heading text-3xl @[64rem]:text-4xl">{s.newsletterHeading}</p>
              {s.newsletterText ? <p className="text-sm opacity-80">{s.newsletterText}</p> : null}
            </div>
            <div className="sf-footer-newsletter w-full">
              <NewsletterForm buttonLabel="Subscribe" />
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 @[64rem]:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))]">
            <div className="col-span-2 space-y-4 @[64rem]:col-span-1">
              <p className="sf-heading text-3xl">{store.name}</p>
              <About s={s} ctx={ctx} />
              <FooterSocial s={s} ctx={ctx} className="pt-1" />
            </div>
            <FooterMenus s={s} ctx={ctx} />
            <div className="col-span-2 @[48rem]:col-span-1">
              <FooterContact s={s} ctx={ctx} />
            </div>
          </div>
        </div>
      );
    case "footer-brand":
      return (
        <div className="relative grid @[64rem]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="sf-tone-accent flex flex-col justify-between gap-8 px-4 py-12 @[48rem]:px-10 @[64rem]:px-14 @[64rem]:py-16">
            <div className="space-y-4">
              <p className="sf-heading text-4xl @[64rem]:text-5xl">{store.name}</p>
              <About s={s} ctx={ctx} />
            </div>
            <FooterSocial s={s} ctx={ctx} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 @[48rem]:grid-cols-3 @[48rem]:px-10 @[64rem]:px-14 @[64rem]:py-16">
            <FooterMenus s={s} ctx={ctx} />
            <div className="col-span-2 @[48rem]:col-span-1">
              <FooterContact s={s} ctx={ctx} />
            </div>
          </div>
        </div>
      );
    case "footer-app": {
      const wa = whatsappUrl(store.whatsapp);
      const tel = telHref(store.phone);
      const address = formatAddress(store.address);
      const buttons: { kind: "wa" | "call" | "mail" | "map"; label: string; detail: string; href: string; external: boolean }[] = s.showContact
        ? [
            ...(wa ? [{ kind: "wa" as const, label: "WhatsApp", detail: "Chat with us", href: wa, external: true }] : []),
            ...(store.phone && tel ? [{ kind: "call" as const, label: "Call", detail: store.phone, href: tel, external: false }] : []),
            ...(store.email ? [{ kind: "mail" as const, label: "Email", detail: store.email, href: `mailto:${store.email}`, external: false }] : []),
            ...(address.length ? [{ kind: "map" as const, label: "Visit", detail: address[address.length - 1] ?? "", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(", "))}`, external: true }] : []),
          ]
        : [];
      return (
        <div className="sf-container relative space-y-10 py-12">
          <div className="flex flex-col gap-3 @[64rem]:flex-row @[64rem]:items-end @[64rem]:justify-between">
            <div className="space-y-2">
              <p className="sf-heading text-3xl">{store.name}</p>
              <About s={s} ctx={ctx} className="max-w-md" />
            </div>
            <FooterSocial s={s} ctx={ctx} />
          </div>
          {buttons.length ? (
            <ul className={`grid grid-cols-2 gap-3 ${buttons.length >= 4 ? "@[64rem]:grid-cols-4" : buttons.length === 3 ? "@[64rem]:grid-cols-3" : ""}`} aria-label="Contact us">
              {buttons.map((b) => (
                <li key={b.kind}>
                  <a href={b.href} {...(b.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="sf-footer-badge">
                    <span className="sf-footer-badge-icon">
                      <ContactIcon kind={b.kind} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{b.label}</span>
                      <span className="block truncate text-xs opacity-75">{b.detail}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 @[48rem]:grid-cols-4">
            <FooterMenus s={s} ctx={ctx} />
          </div>
        </div>
      );
    }
    case "footer-illustrated":
      return (
        <div className="relative">
          <div className="sf-container grid gap-10 py-12 @[48rem]:grid-cols-2 @[64rem]:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <div className="space-y-4">
              <p className="sf-heading text-3xl">{store.name}</p>
              <About s={s} ctx={ctx} />
              <FooterSocial s={s} ctx={ctx} className="pt-1" />
            </div>
            <FooterMenus s={s} ctx={ctx} />
            <FooterContact s={s} ctx={ctx} />
          </div>
          <FooterIllustration s={s} fallback />
        </div>
      );
    case "footer-tworow": {
      const links = s.menuHandles.flatMap((h) => ctx.menus[h]?.items ?? []);
      const tel = telHref(store.phone);
      const year = new Date().getFullYear();
      return (
        <div className="sf-container relative py-8">
          <div className="flex flex-col gap-5 @[64rem]:flex-row @[64rem]:items-center @[64rem]:justify-between">
            <p className="sf-heading text-2xl">{store.name}</p>
            {links.length ? (
              <nav aria-label="Footer">
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {links.map((n) => (
                    <li key={n.id}>
                      <FooterLink node={n} />
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-current/15 pt-6 text-xs @[64rem]:flex-row @[64rem]:items-center @[64rem]:justify-between">
            <p className="flex flex-wrap gap-x-4 gap-y-1 opacity-80">
              <span>{s.copyright || `© ${year} ${store.name}`}</span>
              {s.showContact && store.email ? (
                <a href={`mailto:${store.email}`} className="sf-footer-link">
                  {store.email}
                </a>
              ) : null}
              {s.showContact && store.phone && tel ? (
                <a href={tel} className="sf-footer-link">
                  {store.phone}
                </a>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {s.showPaymentNote ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Payment methods">
                  {payments.map((m) => (
                    <li key={m} className="sf-footer-pay">
                      {m}
                    </li>
                  ))}
                </ul>
              ) : null}
              <FooterSocial s={s} ctx={ctx} />
            </div>
          </div>
        </div>
      );
    }
  }
}
