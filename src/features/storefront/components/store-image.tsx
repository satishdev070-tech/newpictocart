import Image, { getImageProps } from "next/image";
import { assetUrl } from "@/lib/storage/assets";

import imageLoader from "@/lib/images/loader";
import { IconGlyph } from "@/lib/icons/icon-glyph";
import { parseIconValue } from "@/lib/icons/names";

/** A stand-in photo (Unsplash stock, src/lib/unsplash-stock.ts) for an empty image slot. */
export type ImageFallback = { url: string; alt: string };

/**
 * Tenant image from Supabase Storage via next/image. When the path is empty/invalid (assetUrl only
 * accepts tenant/{uuid}/... paths) it shows the `stock` photo if given, else a neutral placeholder.
 * An allowlisted `icon:<name>` value (media picker Icons tab) renders as an inline SVG icon instead.
 */
export function StoreImage({
  path,
  alt,
  sizes,
  priority = false,
  className = "",
  natural = false,
  stock = null,
}: {
  path: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Full width, height from the image's own proportions (never cropped). Used by banner slides. */
  natural?: boolean;
  /** Stand-in photo when the path is empty. */
  stock?: ImageFallback | null;
}) {
  // Library icon (`icon:<name>`, allowlisted): inline SVG tinted with the theme colours, no request.
  if (parseIconValue(path)) {
    const box = "grid place-items-center bg-[color-mix(in_srgb,var(--sf-primary)_7%,var(--sf-bg))] text-[var(--sf-primary)]";
    return (
      <div className={natural ? `${box} aspect-[3/1] w-full ${className}` : `${box} absolute inset-0 ${className}`}>
        <IconGlyph value={path} label={alt} className="h-1/2 max-h-40 w-1/2 max-w-40" />
      </div>
    );
  }
  const own = assetUrl(path);
  const src = own ?? stock?.url ?? null;
  const label = !own && stock ? alt || stock.alt : alt;
  if (!src) {
    return <div aria-hidden className={`absolute inset-0 bg-[color-mix(in_srgb,var(--sf-border)_60%,var(--sf-surface))] ${className}`} />;
  }
  // `priority` = the LCP candidate (eager, high fetch priority, preloaded); everything else lazy-loads.
  // Kept on the deprecated `priority` prop on purpose: `preload` emits a different preload hint, and
  // the browser then reuses a different candidate width (measurable pixel change on live stores).
  if (natural) return <Image src={src} alt={label} width={0} height={0} sizes={sizes} priority={priority} className={`block h-auto w-full ${className}`} />;
  return <Image src={src} alt={label} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}

/**
 * Art-directed image: a separate phone image below 48rem (the storefront's mobile breakpoint,
 * same as .sf-hide-mobile / .sf-hide-desktop). Rendered as one <picture>, so each device downloads
 * and (for the LCP slide) preloads only its own file, instead of two CSS-hidden <img>s that both
 * load. Falls back to StoreImage when either path is missing.
 */
export function StoreArtImage({
  path,
  mobilePath,
  alt,
  sizes,
  priority = false,
  natural = false,
  stock = null,
}: {
  path: string | null | undefined;
  mobilePath: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  natural?: boolean;
  stock?: ImageFallback | null;
}) {
  // Icon values have no URL, so they take the StoreImage path below (which renders the icon).
  const desktop = assetUrl(path);
  const mobile = assetUrl(mobilePath);
  if (!desktop || !mobile) return <StoreImage path={path || mobilePath} alt={alt} sizes={sizes} priority={priority} natural={natural} stock={stock} />;
  // getImageProps ignores `priority`; the LCP slide gets an eager, high-priority fetch instead.
  const common = { alt, sizes, ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}), ...(natural ? { width: 0, height: 0 } : { fill: true }) };
  const { props: d } = getImageProps({ ...common, src: desktop });
  const { props: m } = getImageProps({ ...common, src: mobile });
  return (
    <picture className={natural ? "block" : "absolute inset-0"}>
      <source media="(max-width: 47.99rem)" srcSet={m.srcSet} sizes={m.sizes} />
      <source media="(min-width: 48rem)" srcSet={d.srcSet} sizes={d.sizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is in the spread props */}
      <img {...d} className={natural ? "block h-auto w-full" : "object-cover"} />
    </picture>
  );
}

/**
 * Resized URL (a pre-sized WebP copy via lib/images/loader) for a tenant image rendered with a plain
 * <img> whose size comes from the file itself, e.g. the header logo (`h-auto w-auto` + max caps).
 * Copies are never enlarged, so the image keeps its natural size up to the copy's width; a CSS cap
 * at or below `width` renders it at the original's size, except that the resized height is rounded
 * to whole pixels (pass the original ratio as CSS aspect-ratio for an exact match, as
 * features/storefront/server/logo.ts does for the header logo).
 * `width` must be one of next.config images.deviceSizes/imageSizes. Null for invalid paths.
 */
export function storeImageSrc(path: string | null | undefined, width: 384 | 640 = 640): string | null {
  const src = assetUrl(path);
  // SVG (vector) and GIF (may be animated) are used as they are; the loader passes them through.
  if (!src || /\.(svg|gif)$/i.test(src)) return src;
  return imageLoader({ src, width });
}
