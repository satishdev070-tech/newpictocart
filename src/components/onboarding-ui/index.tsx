import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { jetbrainsMono, manrope } from "@/app/fonts";
import { cn } from "@/lib/cn";

/**
 * Shared look for auth + onboarding (/login, /signup, /start/*, /start/informative/*, /onboarding).
 * Same dark editorial tokens as the marketing site (`.theme-marketing`, REDESIGN_NOTES.md):
 * near-black surfaces, off-white text, one Pictocart orange accent (#ea580c), Manrope display.
 * Server-safe (no hooks) so pages stay light on Workers; client screens import the class helpers.
 */

/** Root wrapper: applies the marketing tokens + fonts and a soft orange glow behind the content. */
export function OnboardingTheme({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "theme-marketing relative isolate min-h-dvh overflow-x-clip bg-mk-bg font-sans text-mk-text antialiased",
        manrope.variable,
        jetbrainsMono.variable,
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(234_88_12/0.16),transparent_70%)]"
      />
      {children}
    </div>
  );
}

/** Large display heading (Manrope). `accent` renders in orange after the main text. */
export function OnbHeading({
  children,
  accent,
  as: Tag = "h1",
  className,
}: {
  children: ReactNode;
  accent?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <Tag className={cn("font-brand text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-mk-text", className)}>
      {children}
      {accent ? <span className="text-mk-accent"> {accent}</span> : null}
    </Tag>
  );
}

/** Mono uppercase eyebrow, like marketing section labels. */
export function OnbEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-mk-mono text-[11px] font-medium uppercase tracking-[0.18em] text-mk-accent", className)}>{children}</p>;
}

export function OnbSub({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-base leading-relaxed text-mk-muted", className)}>{children}</p>;
}

/** Elevated card surface. */
export function OnbCard({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className={cn("rounded-[var(--r-lg)] border border-mk-line bg-mk-elev-1 p-6 shadow-[var(--brand-shadow-card)] sm:p-8", className)}
    >
      {children}
    </div>
  );
}

/** Button class names (use on <button>, <Link>, SubmitButton className with !important where needed). */
export const onbButton = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-mk-accent px-6 text-[15px] font-semibold text-mk-accent-ink shadow-[0_10px_30px_-10px_var(--accent-glow)] transition-colors duration-200 hover:bg-mk-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-mk-line-strong bg-transparent px-6 text-[15px] font-semibold text-mk-text transition-colors duration-200 hover:border-mk-text/40 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent disabled:cursor-not-allowed disabled:opacity-45",
  ghost:
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-mk-muted transition-colors hover:text-mk-text focus-visible:outline-2 focus-visible:outline-mk-accent",
  link: "font-semibold text-mk-accent underline-offset-4 hover:underline",
} as const;

/** Text input / select / textarea class (dark field, orange focus ring). */
export const onbField =
  "block w-full min-h-12 rounded-[var(--r-sm)] border border-mk-line-strong bg-mk-elev-2 px-4 text-[15px] text-mk-text placeholder:text-mk-dim transition-colors focus:border-mk-accent focus:outline-none focus:ring-2 focus:ring-mk-accent/30 aria-[invalid=true]:border-red-500/70";

export const onbLabel = "mb-1.5 block text-sm font-medium text-mk-text";
export const onbHint = "mt-1.5 text-xs text-mk-dim";
export const onbError = "mt-1.5 text-sm text-red-400";

/** Selectable choice card (radio-like). Pass `selected`. */
export function onbChoice(selected: boolean, className?: string): string {
  return cn(
    "group relative w-full rounded-[var(--r-md)] border p-5 text-left transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
    selected
      ? "border-mk-accent bg-mk-accent-tint shadow-[0_0_0_1px_var(--mk-accent)]"
      : "border-mk-line bg-mk-elev-1 hover:border-mk-line-strong hover:bg-mk-elev-2",
    className,
  );
}

/** Pill chip (multi-select tags). */
export function onbChip(selected: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
    selected ? "border-mk-accent bg-mk-accent-tint text-mk-text" : "border-mk-line-strong text-mk-muted hover:border-mk-text/40 hover:text-mk-text",
    className,
  );
}

/** "Step 2 of 5" + bar. `label` is optional journey name (e.g. "Online store"). */
export function OnbProgress({ step, total, label, className }: { step: number; total: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((step / total) * 100)));
  return (
    <div className={cn("w-full max-w-xs", className)} aria-label={`Step ${step} of ${total}`}>
      <div className="mb-1.5 flex items-center justify-between font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-dim">
        <span>{label ?? "Setup"}</span>
        <span>
          {step}/{total}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-mk-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Top bar: logo (links home) on the left, optional progress in the middle, extras on the right. */
export function OnbTopBar({ logo, progress, right }: { logo: ReactNode; progress?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
      {/* The platform logo has navy lettering, so on dark it sits on a white chip (as the marketing footer does). */}
      <Link
        href="/"
        className="inline-flex shrink-0 items-center rounded-[var(--r-sm)] bg-white px-2.5 py-1 shadow-[var(--brand-shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-accent [&_img]:max-h-8"
        aria-label="Pictocart home"
      >
        {logo}
      </Link>
      <div className="hidden flex-1 justify-center sm:flex">{progress}</div>
      <div className="flex shrink-0 items-center gap-2 text-sm">{right}</div>
      {progress ? <div className="absolute inset-x-4 top-[68px] sm:hidden">{progress}</div> : null}
    </header>
  );
}
