import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared primitives of the informative section library. Everything reads design tokens from the CSS
 * variables set on the site root (themes/tokens.ts), never hard-coded colours, so all 11 themes and
 * seller overrides go through one code path. Motion only under `motion-safe:` (prefers-reduced-motion).
 */
export const heading = "[font-family:var(--if-font-heading)] [text-transform:var(--if-heading-case)] tracking-tight";
export const container = "mx-auto w-full max-w-6xl";
export const card = "rounded-(--if-radius) border border-(--if-border) bg-(--if-surface) shadow-(--if-shadow)";
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--if-link)";
export const btnPrimary = cn(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-(--if-radius) bg-(--if-primary) px-5 py-2.5 text-sm font-semibold text-(--if-on-primary) motion-safe:transition-opacity hover:opacity-90",
  focusRing,
);
export const btnSecondary = cn(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-(--if-radius) border border-current px-5 py-2.5 text-sm font-semibold motion-safe:transition-opacity hover:opacity-80",
  focusRing,
);

export function Section({ id, tone = "bg", children, className, labelledBy }: { id?: string; tone?: "bg" | "surface"; children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("px-4 py-(--if-section-y) sm:px-6", tone === "surface" ? "bg-(--if-surface)" : "bg-(--if-bg)", className)}>
      <div className={container}>{children}</div>
    </section>
  );
}

export function SectionHeading({ id, eyebrow, title, intro, align = "left", motif }: { id: string; eyebrow?: string | null; title: string; intro?: string | null; align?: "left" | "center"; motif?: string }) {
  return (
    <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <p className="mb-2 text-sm font-semibold tracking-wide text-(--if-link) uppercase">{eyebrow}</p> : null}
      {motif === "gold-rules" ? <span aria-hidden className={cn("mb-4 block h-px w-16 bg-(--if-primary)", align === "center" && "mx-auto")} /> : null}
      <h2 id={id} className={cn(heading, "text-3xl font-semibold sm:text-4xl")}>
        {title}
      </h2>
      {intro ? <p className="mt-3 text-base text-(--if-muted) sm:text-lg">{intro}</p> : null}
    </div>
  );
}

/** Lazy, sized image (CLS-safe). `priority` only for the hero (LCP). */
export function Img({ src, alt, width, height, className, priority = false }: { src: string; alt: string; width: number; height: number; className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized Unsplash / store-asset URLs; see docs/informative/PROGRESS.md (M3)
    <img src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} className={className} />
  );
}

export function Stars({ rating }: { rating: number }) {
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <p className="text-(--if-link)" aria-label={`Rated ${r} out of 5`}>
      <span aria-hidden>{"★".repeat(r)}{"☆".repeat(5 - r)}</span>
    </p>
  );
}

/** wa.me deep link with a friendly prefilled message (digits only, as WhatsApp requires). */
export function whatsappHref(number: string | null, businessName: string): string | null {
  const digits = number?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${businessName}, I'd like to know more.`)}`;
}

export function telHref(phone: string | null): string | null {
  const v = phone?.replace(/[^\d+]/g, "") ?? "";
  return v.length >= 10 ? `tel:${v}` : null;
}
