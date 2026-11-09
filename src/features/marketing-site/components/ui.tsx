import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { analyticsAttributes, type AnalyticsEvent } from "../analytics";
import { CardGlow } from "./card-glow";

/**
 * Shared marketing primitives for the dark editorial system (`.theme-marketing`).
 * Accent CTAs use mint; secondary actions stay bordered/transparent. Variant names are
 * stable so existing callers (`cta`, `orange`, `primary`, …) keep working.
 */

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[color,background-color,box-shadow,border-color,transform] duration-[var(--dur-fast,200ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent disabled:opacity-60";

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3.5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
} as const;

/** Mint fill + dark ink — primary money CTAs. */
const accentFill =
  "bg-mk-accent text-mk-accent-ink font-semibold hover:bg-mk-accent-hover hover:shadow-[0_0_40px_var(--accent-glow)]";

const variants = {
  primary: accentFill,
  cta: accentFill,
  orange: accentFill,
  indigo: accentFill,
  night: accentFill,
  light: accentFill,
  secondary:
    "border border-mk-line-strong bg-transparent text-mk-text hover:bg-mk-elev-2 hover:border-mk-line-strong",
  ghostLight:
    "border border-mk-line-strong bg-transparent text-mk-text hover:bg-mk-elev-2",
} as const;

export function buttonClass(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(base, sizes[size], variants[variant], extra);
}

type Track = { event?: AnalyticsEvent; id: string; location: string };

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  track,
  external,
  prefetch,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  track?: Track;
  external?: boolean;
  /** Pass false for links to route handlers that redirect (e.g. /themes/[key]/use). */
  prefetch?: boolean;
}) {
  const attrs = track ? analyticsAttributes(track.event ?? "cta_click", track.id, track.location) : {};
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} {...attrs}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)} {...attrs}>
      {children}
    </Link>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mk-container", className)}>{children}</div>;
}

const sectionTones = {
  white: "bg-mk-bg text-mk-text",
  canvas: "bg-mk-elev-1 text-mk-text",
  ink: "bg-mk-bg text-mk-text",
} as const;

export function Section({
  id,
  children,
  className,
  labelledBy,
  tone = "white",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  tone?: keyof typeof sectionTones;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("mk-section", sectionTones[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "light" | "muted" }) {
  return (
    <p
      className={cn(
        "mk-label",
        tone === "muted" ? "text-mk-muted" : tone === "light" ? "text-mk-muted" : "text-mk-accent",
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  align = "center",
  as: As = "h2",
  tone = "dark",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "center" | "left";
  as?: "h1" | "h2";
  tone?: "dark" | "light";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow tone={tone === "light" ? "muted" : "brand"}>{eyebrow}</Eyebrow> : null}
      <As id={id} className={cn("mk-display-lg mt-3 text-balance text-mk-text")}>
        {title}
      </As>
      {body ? <p className={cn("mk-body-lg mt-4 max-w-[60ch] text-mk-muted", align === "center" && "mx-auto")}>{body}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  /** Cursor-following accent radial (client). Pass false for static cards. */
  glow?: boolean;
}) {
  const inner = (
    <>
      {glow ? <div className="mk-card-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-fast,200ms)] group-hover/card:opacity-100" aria-hidden /> : null}
      <div className="relative z-[1]">{children}</div>
    </>
  );

  const shell = cn(
    "group/card relative overflow-hidden rounded-mk-lg border border-mk-line bg-mk-elev-1 p-7 sm:p-8",
    "transition-[border-color,transform,box-shadow] duration-[var(--dur-fast,200ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
    "hover:-translate-y-1 hover:border-mk-line-strong",
    "motion-reduce:hover:translate-y-0",
    className,
  );

  if (!glow) {
    return <div className={shell}>{inner}</div>;
  }
  return <CardGlow className={shell}>{inner}</CardGlow>;
}

export function Pill({ children, className, href }: { children: ReactNode; className?: string; href?: string }) {
  const cls = cn(
    "inline-flex items-center rounded-full border border-mk-line px-3.5 py-1.5 text-sm text-mk-muted",
    "transition-[color,border-color] duration-[var(--dur-fast,200ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
    "hover:border-mk-accent hover:text-mk-accent",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <span className={cls}>{children}</span>;
}

/** Small "Demo data" chip for illustrative product visuals. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-mk-accent-tint px-2.5 py-0.5 text-[11px] font-semibold text-mk-accent", className)}>
      Demo data
    </span>
  );
}
