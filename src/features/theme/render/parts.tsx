import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionSettings } from "@/features/theme/sections/definitions";
import type { ListArgs } from "@/features/storefront/server/catalog";

/** Building blocks shared by the section renderers (./sections.tsx) and the layout variants (./variants.tsx). */

export type HeadingStyle = "default" | "condensed" | "italic";
export type IntroProps = { eyebrow?: string; heading?: string; subheading?: string; accent?: string; headingStyle?: HeadingStyle; note?: string; action?: ReactNode };

/** Intro props from a section's shared heading settings. */
export function hp(s: { eyebrow: string; heading: string; subheading: string; headingAccent?: string; headingStyle?: HeadingStyle; headingNote?: string }): IntroProps {
  return { eyebrow: s.eyebrow, heading: s.heading, subheading: s.subheading, accent: s.headingAccent, headingStyle: s.headingStyle, note: s.headingNote };
}

/** Heading text plus the optional italic accent words. */
export function HeadingText({ heading, accent }: { heading?: string; accent?: string }) {
  return accent ? (
    <>
      {heading} <em className="sf-heading-accent">{accent}</em>
    </>
  ) : (
    <>{heading}</>
  );
}

export const headingClass = (style: HeadingStyle | undefined, base: string) => (style === "condensed" ? "sf-heading sf-display-condensed text-4xl @[64rem]:text-5xl" : style === "italic" ? `${base} italic` : base);

export function Intro({ eyebrow, heading, subheading, accent, headingStyle, note, action }: IntroProps) {
  if (!eyebrow && !heading && !subheading && !action && !note) return null;
  return (
    <div className="sf-intro mb-8 flex flex-col gap-2 @[48rem]:flex-row @[48rem]:items-end @[48rem]:justify-between">
      <div className="max-w-2xl space-y-2">
        {eyebrow ? <p className="sf-eyebrow">{eyebrow}</p> : null}
        {heading ? <h2 className={headingClass(headingStyle, "sf-heading text-3xl @[64rem]:text-4xl")}>{accent ? <HeadingText heading={heading} accent={accent} /> : heading}</h2> : null}
        {subheading ? <p className="sf-muted">{subheading}</p> : null}
      </div>
      {action}
      {note ? <p className="sf-intro-note">{note}</p> : null}
    </div>
  );
}

export function Cta({ label, href, className = "sf-btn" }: { label?: string; href?: string; className?: string }) {
  if (!label || !href) return null;
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function ViewAll({ href }: { href?: string }) {
  return href ? (
    <Link href={href} className="sf-link text-sm">
      View all →
    </Link>
  ) : null;
}

export type ProductSourceSettings = SectionSettings<"ProductGrid">;
export function sourceArgs(s: Pick<ProductSourceSettings, "source" | "collectionId" | "categoryId" | "productIds" | "ruleTags" | "ruleProductTypes" | "ruleMaxPrice" | "ruleOnSale" | "limit">): ListArgs | null {
  const base: ListArgs = { p_limit: s.limit, p_offset: 0, p_sort: "featured" };
  switch (s.source) {
    case "collection":
      return s.collectionId ? { ...base, p_collection: s.collectionId, p_sort: "manual" } : null;
    case "category":
      return s.categoryId ? { ...base, p_category: s.categoryId } : null;
    case "products":
      return s.productIds.length ? { ...base, p_product_ids: s.productIds } : null;
    case "rules":
      return {
        ...base,
        ...(s.ruleTags.length ? { p_tags: s.ruleTags } : {}),
        ...(s.ruleProductTypes.length ? { p_product_types: s.ruleProductTypes } : {}),
        ...(s.ruleMaxPrice > 0 ? { p_max_price: s.ruleMaxPrice } : {}),
        ...(s.ruleOnSale ? { p_on_sale: true } : {}),
      };
    case "newest":
      return { ...base, p_sort: "newest" };
    case "bestselling":
      return { ...base, p_sort: "best_selling" };
    case "featured":
      return { ...base, p_featured: true };
    case "sale":
      return { ...base, p_on_sale: true };
  }
}
