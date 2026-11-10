import type { ReactNode } from "react";
import { Heart, PackageCheck, Sparkles, Zap } from "lucide-react";
import type { ThemeConfig } from "@/features/theme/schema/config";
import { templatePageContent } from "@/features/theme/render/page-content";
import type { AccountPack } from "@/features/theme/sections/variants";
import { StoreImage } from "@/features/storefront/components/store-image";
import { cn } from "@/lib/cn";

/** The store's own hero art (first Hero slide of the published theme), for the auth visual. */
export function heroImageOf(theme: ThemeConfig): { path: string; alt: string } | null {
  for (const s of theme.templates.home) {
    if (s.type !== "Hero") continue;
    const slide = (s.settings as { slides?: { imagePath?: string; mobileImagePath?: string; alt?: string }[] }).slides?.[0];
    const path = slide?.mobileImagePath || slide?.imagePath;
    if (path) return { path, alt: slide?.alt ?? "" };
  }
  return null;
}

/** Account PageContent pack + optional imagePath, falling back to the home Hero slide. */
export function accountAuthVisual(theme: ThemeConfig): { pack: AccountPack; image: { path: string; alt: string } | null } {
  const { pack, imagePath } = templatePageContent(theme, "account");
  if (imagePath) return { pack, image: { path: imagePath, alt: "" } };
  return { pack, image: heroImageOf(theme) };
}

const BENEFITS = [
  { icon: PackageCheck, text: "Track orders and returns" },
  { icon: Heart, text: "Save your wishlist" },
  { icon: Zap, text: "Faster checkout with saved addresses" },
  { icon: Sparkles, text: "Early access to new drops and offers" },
];

/**
 * Shopper sign-in / sign-up inside the storefront chrome. Pack comes from templates.account
 * PageContent settings (Change design → Account layout).
 */
export function StoreAuthSplit({
  image,
  storeName,
  heading,
  text,
  showBenefits = false,
  pack = "image-left",
  children,
}: {
  image: { path: string; alt: string } | null;
  storeName: string;
  heading: string;
  text: string;
  showBenefits?: boolean;
  pack?: AccountPack;
  children: ReactNode;
}) {
  const showPanel = pack !== "minimal";
  const useBrand = pack === "brand-panel";
  const stacked = pack === "stacked";
  const imageRight = pack === "image-right";

  const panel = showPanel ? (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--sf-primary)]",
        stacked ? "min-h-[220px] @[64rem]:min-h-[280px]" : "hidden min-h-[560px] @[64rem]:block",
      )}
    >
      {!useBrand && image ? <StoreImage path={image.path} alt={image.alt} sizes={stacked ? "100vw" : "60vw"} /> : null}
      <div aria-hidden className={cn("absolute inset-0", useBrand ? "bg-[var(--sf-primary)]" : "bg-gradient-to-t from-black/70 via-black/20 to-transparent")} />
      <div className={cn("absolute inset-x-0 bottom-0 space-y-4 p-8 text-white @[64rem]:p-10", stacked && "p-6")}>
        <p className="sf-eyebrow !text-white/80">{storeName}</p>
        <p className={cn("sf-heading leading-tight", stacked ? "text-2xl" : "text-4xl")}>{heading}</p>
        <p className="max-w-md text-sm text-white/85">{text}</p>
        {showBenefits && !stacked ? (
          <ul className="grid gap-2.5 pt-2 text-sm @[80rem]:grid-cols-2">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-center gap-2.5">
                <b.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                {b.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  ) : null;

  const form = (
    <div className={cn("flex flex-col justify-center px-0 py-4", showPanel && !stacked ? "@[64rem]:px-12 @[64rem]:py-14" : "py-6")}>
      <div className="mx-auto w-full max-w-sm">{children}</div>
    </div>
  );

  return (
    <div className="sf-container sf-section" data-pc-account-pack={pack}>
      <div
        className={cn(
          "grid overflow-hidden rounded-[var(--sf-radius-card)]",
          stacked ? "gap-0" : showPanel ? "@[64rem]:grid-cols-[3fr_2fr] @[64rem]:border @[64rem]:border-[var(--sf-border)]" : "",
          imageRight && showPanel && !stacked && "@[64rem]:grid-cols-[2fr_3fr]",
        )}
      >
        {imageRight && !stacked ? (
          <>
            {form}
            {panel}
          </>
        ) : (
          <>
            {panel}
            {form}
          </>
        )}
      </div>
    </div>
  );
}
