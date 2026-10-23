import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";
import { InformativeThemeMockup, ThemeMockup } from "@/features/theme/marketplace/mockup";
import { THEME_STYLE_LABELS, type MarketplaceTheme } from "@/features/theme/marketplace/types";
import { themeSiteType } from "@/features/theme/marketplace/types";
import { industryShort } from "@/features/stores/industries";
import { analyticsAttributes } from "../analytics";
import { buttonClass } from "./ui";
import { DESKTOP_VIEWPORT, LiveFrame, PHONE_VIEWPORT } from "./live-frame";
import { ClickToLive } from "./click-to-live";
import { themeShot, type ShotDevice } from "../theme-shots";
import { themePreviewHref } from "../themes";
import type { ReactNode } from "react";
import type { CategoryImage } from "@/lib/unsplash";

/** Short display name for the theme's mock store header ("Heritage Kashmir" -> "Heritage"). */
const mockName = (t: MarketplaceTheme) => t.name.split(" ")[0]!;

/** A theme screenshot (static file) or, when none was captured, the token mockup. `fill` sizes it to its frame. */
function Still({ theme, device, size, eager, fill = false }: { theme: MarketplaceTheme; device: ShotDevice; size: "card" | "large"; eager: boolean; fill?: boolean }) {
  if (themeSiteType(theme) === "informative") {
    return <div className={fill ? "size-full overflow-hidden" : "overflow-hidden"}><InformativeThemeMockup theme={theme} size={device === "phone" ? "phone" : size === "large" ? "large" : "card"} /></div>;
  }
  const shot = themeShot(theme.key, device);
  const vp = device === "desktop" ? DESKTOP_VIEWPORT : PHONE_VIEWPORT;
  return (
    <div className={fill ? "size-full overflow-hidden" : "overflow-hidden"} style={{ aspectRatio: fill ? undefined : `${vp.width} / ${vp.height}`, background: theme.preset.tokens.colors.background }}>
      {shot ? (
        // Plain <img> on purpose: a pre-sized static WebP needs no Image Optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot} alt="" width={vp.width} height={vp.height} loading={eager ? "eager" : "lazy"} decoding="async" className="block size-full object-cover object-top" />
      ) : (
        <ThemeMockup preset={theme.preset} name={mockName(theme)} tagline={theme.tagline} size={device === "phone" ? "phone" : size === "large" ? "large" : "card"} />
      )}
    </div>
  );
}

/**
 * Card desktop frame content: the captured screenshot first, else the theme's category photo
 * (Unsplash), else the token mockup. The photo zooms gently on card hover.
 */
function CardDesktop({ theme, image }: { theme: MarketplaceTheme; image?: CategoryImage | null }) {
  if (themeSiteType(theme) === "informative") return <InformativeThemeMockup theme={theme} />;
  if (themeShot(theme.key, "desktop") || !image) return <Still theme={theme} device="desktop" size="card" eager={false} fill />;
  return (
    <div className="relative size-full overflow-hidden bg-brand-canvas">
      {/* Already sized by the Unsplash URL (800x500), so no loader/optimizer pass is needed. */}
      <Image src={image.url} alt="" fill unoptimized sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    </div>
  );
}

const DOTS = (
  <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-brand-canvas px-3 py-2">
    <span className="size-2 rounded-full bg-border-strong" />
    <span className="size-2 rounded-full bg-border-strong" />
    <span className="size-2 rounded-full bg-border-strong" />
  </div>
);

function Devices({ desktop, phone, size }: { desktop: ReactNode; phone: ReactNode; size: "card" | "large" }) {
  if (size === "card") {
    // Fixed 4:3 stage: the phone is sized by the stage height and pinned inside it, so it never
    // overhangs the card and every card's preview is exactly the same height.
    return (
      <div className="relative aspect-[4/3] w-full" aria-hidden>
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-brand-md border border-border bg-white shadow-brand-card">
          {DOTS}
          <div className="relative min-h-0 flex-1 overflow-hidden">{desktop}</div>
        </div>
        <div className="absolute right-2.5 bottom-2.5 aspect-[390/844] h-[78%] overflow-hidden rounded-[14px] border-4 border-brand-ink bg-brand-ink shadow-brand-float transition-transform duration-500 ease-out group-hover:-translate-y-1 motion-reduce:transition-none">
          <div className="size-full overflow-hidden rounded-[10px]">{phone}</div>
        </div>
      </div>
    );
  }
  // Large (hero): desktop fills the stage; phone is height-capped so it reads as a handset, not a tall strip.
  return (
    <div className="relative w-full" aria-hidden>
      <div className="overflow-hidden rounded-brand-md border border-border bg-white shadow-brand-card">
        {DOTS}
        {desktop}
      </div>
      <div className="absolute right-2 bottom-2 aspect-[9/16] h-[52%] max-h-52 overflow-hidden rounded-[18px] border-[5px] border-brand-ink bg-brand-ink shadow-brand-float sm:right-4 sm:bottom-3 sm:h-[56%] sm:max-h-60 sm:rounded-[20px] sm:border-[6px]">
        <div className="size-full overflow-hidden rounded-[13px] sm:rounded-[14px]">{phone}</div>
      </div>
    </div>
  );
}

/**
 * Desktop browser frame + phone frame showing the theme: a pre-captured screenshot (or the token
 * mockup). With `live` and a demo URL, a "Live preview" button swaps in the real demo store at true
 * device widths (1280px desktop, 390x844 phone), loaded only on request.
 */
export function ThemeDevicePreview({ theme, previewUrl = null, size = "card", eager = false, live = false, image = null }: { theme: MarketplaceTheme; previewUrl?: string | null; size?: "card" | "large"; eager?: boolean; live?: boolean; image?: CategoryImage | null }) {
  const card = size === "card";
  // Phone frames are always height-capped by Devices; fill so the shot crops instead of forcing a tall ratio.
  const still = (
    <Devices
      size={size}
      desktop={card ? <CardDesktop theme={theme} image={image} /> : <Still theme={theme} device="desktop" size={size} eager={eager} />}
      phone={<Still theme={theme} device="phone" size={size} eager={eager} fill />}
    />
  );
  if (!live || !previewUrl) return still;
  const liveView = (
    <Devices
      size={size}
      desktop={<LiveFrame src={previewUrl} viewport={DESKTOP_VIEWPORT} fallback={<Still theme={theme} device="desktop" size={size} eager />} eager />}
      phone={<LiveFrame src={previewUrl} viewport={PHONE_VIEWPORT} fallback={<Still theme={theme} device="phone" size={size} eager fill />} eager fill />}
    />
  );
  return <ClickToLive still={still} live={liveView} label="Live preview" />;
}

/** "Photo: Name / Unsplash" credit, required by the Unsplash API guidelines. */
function PhotoCredit({ image }: { image: CategoryImage }) {
  const link = "underline decoration-white/50 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-white";
  return (
    <p className="absolute bottom-2.5 left-2.5 max-w-[62%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] leading-4 text-white backdrop-blur-sm">
      Photo:{" "}
      {image.photographer ? (
        <>
          <a href={image.photographer.url} target="_blank" rel="noopener noreferrer" className={link}>
            {image.photographer.name}
          </a>{" "}
          /{" "}
        </>
      ) : null}
      <a href={image.unsplashUrl} target="_blank" rel="noopener noreferrer" className={link}>
        Unsplash
      </a>
    </p>
  );
}

const PILL = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold";

/**
 * Theme card. Preview priority: captured screenshot, then `image` (the theme's category photo,
 * from src/lib/unsplash.ts), then the token mockup. "Preview Theme" opens the on-site preview page
 * (live demo store when one is up, else the sample store), so it works for every theme.
 * Fixed-ratio preview + clamped copy keep every card in a row the same height with the buttons
 * aligned along the bottom.
 */
export function ThemeCard({ theme, headingLevel = "h3", location, image = null }: { theme: MarketplaceTheme; headingLevel?: "h2" | "h3"; location: string; image?: CategoryImage | null }) {
  const H = headingLevel;
  const photo = themeSiteType(theme) === "informative" ? null : image && !themeShot(theme.key, "desktop") ? image : null;
  return (
    <article className="group flex h-full flex-col rounded-brand-lg border border-border bg-white p-4 transition duration-300 ease-out hover:-translate-y-1 hover:border-brand/30 hover:shadow-brand-card motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative">
        <Link href={`/themes/${theme.key}`} className="block rounded-brand-md" tabIndex={-1} aria-hidden>
          <ThemeDevicePreview theme={theme} image={photo} />
        </Link>
        {photo ? <PhotoCredit image={photo} /> : null}
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${PILL} bg-brand-ink/8 text-brand-ink`}>{themeSiteType(theme) === "informative" ? "Informative" : "Online store"}</span>
          <span className={`${PILL} bg-brand-soft text-brand`}>{industryShort(theme.industry)}</span>
          <span className={`${PILL} bg-brand-canvas text-muted`}>{THEME_STYLE_LABELS[theme.style]}</span>
        </div>
        <H className="mt-3 font-brand text-lg leading-snug font-bold text-brand-ink">
          <Link href={`/themes/${theme.key}`} className="rounded-sm transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {theme.name}
          </Link>
        </H>
        <p className="mt-1 line-clamp-2 min-h-[2lh] text-sm text-muted">{theme.tagline}</p>
        <div className="mt-auto grid gap-2 pt-5">
          <Link href={themePreviewHref(theme.key)} prefetch={false} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "w-full")} {...analyticsAttributes("theme_preview", theme.key, location)}>
            <Eye aria-hidden className="size-3.5" /> Preview Theme <ExternalLink aria-hidden className="size-3" /><span className="sr-only">: {theme.name} (opens in a new tab)</span>
          </Link>
          <Link href={`/themes/${theme.key}/use`} prefetch={false} className={buttonClass("primary", "sm", "w-full")} {...analyticsAttributes("cta_click", `use_${theme.key}`, location)}>
            Use This Theme<span className="sr-only">: {theme.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
