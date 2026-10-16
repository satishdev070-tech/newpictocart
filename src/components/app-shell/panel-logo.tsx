import Link from "next/link";
import { PLATFORM_ICON, PLATFORM_LOGO, PLATFORM_NAME } from "@/config/platform";
import { brandImageView, getPublicPlatformConfig } from "@/features/platform/server/public-config";

/**
 * Pictocart logo for the seller dashboard and super admin sidebars. Same source order as the
 * marketing BrandLogo (logo uploaded in /admin/branding, then PLATFORM_LOGO, then a wordmark),
 * but it links to the panel's home. The built-in logo has navy lettering, so in dark mode it
 * sits on a white chip.
 */
export async function PanelLogo({ href, label }: { href: string; label: string }) {
  const config = await getPublicPlatformConfig();
  const logo = brandImageView(config.headerLogo) ?? PLATFORM_LOGO;
  return (
    <Link href={href} aria-label={label} className="inline-flex max-w-full items-center rounded-md dark:bg-white dark:px-2 dark:py-1">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- already sized for display; width/height reserve space
        <img src={logo.src} width={logo.width ?? undefined} height={logo.height ?? undefined} alt={PLATFORM_NAME} className="h-11 w-auto max-w-[200px] object-contain object-left dark:h-8" />
      ) : (
        <span className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight text-foreground dark:text-[#1b1d45]">{PLATFORM_NAME}</span>
      )}
    </Link>
  );
}

/** Square mark for the collapsed sidebar: the uploaded favicon, else the built-in icon. */
export async function PanelMark({ href, label }: { href: string; label: string }) {
  const config = await getPublicPlatformConfig();
  const src = brandImageView(config.favicon)?.src ?? PLATFORM_ICON;
  return (
    <Link href={href} aria-label={label} className="grid size-10 place-items-center rounded-lg bg-white ring-1 ring-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
      <img src={src} alt="" width={28} height={28} className="size-7 object-contain" />
    </Link>
  );
}
