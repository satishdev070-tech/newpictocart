import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PLATFORM_NAME } from "@/config/platform";
import { BrandLogo } from "@/features/marketing-site/components/brand-logo";
import { OnbEyebrow, OnbHeading, OnbSub, OnboardingTheme } from "@/components/onboarding-ui";

/**
 * Dark editorial skin for the shared form primitives (TextField, PasswordField, SubmitButton,
 * FormMessage, the sign-in tabs) rendered inside auth pages. `.theme-marketing` already remaps the
 * semantic tokens (surface, foreground, border, accent) to the dark palette; these descendant rules
 * add the onboarding kit's shape (tall fields, orange pills, segmented tabs) without editing the
 * app-wide components. Scoped to auth via AuthSplit only.
 */
export const AUTH_FORM_SKIN = [
  // Primary/accent Buttons (SubmitButton) → orange pill.
  "[--primary:var(--mk-accent)] [--primary-foreground:var(--accent-ink)]",
  "[&_button.bg-primary]:!h-auto [&_button.bg-primary]:!min-h-12 [&_button.bg-primary]:!w-full [&_button.bg-primary]:!rounded-full [&_button.bg-primary]:!bg-mk-accent [&_button.bg-primary]:!px-6 [&_button.bg-primary]:!text-[15px] [&_button.bg-primary]:!font-semibold [&_button.bg-primary]:!text-mk-accent-ink [&_button.bg-primary]:shadow-[0_10px_30px_-10px_var(--accent-glow)] [&_button.bg-primary:hover]:!bg-mk-accent-hover [&_button.bg-primary:disabled]:!shadow-none",
  "[&_button.bg-accent]:!h-auto [&_button.bg-accent]:!min-h-12 [&_button.bg-accent]:!w-full [&_button.bg-accent]:!rounded-full [&_button.bg-accent]:!bg-mk-accent [&_button.bg-accent]:!px-6 [&_button.bg-accent]:!text-[15px] [&_button.bg-accent]:!font-semibold [&_button.bg-accent]:!text-mk-accent-ink [&_button.bg-accent:hover]:!bg-mk-accent-hover",
  // Text inputs (TextField / PasswordField use `block w-full`; OTP boxes do not).
  "[&_input.block]:min-h-12 [&_input.block]:rounded-[var(--r-sm)] [&_input.block]:border-mk-line-strong [&_input.block]:bg-mk-elev-2 [&_input.block]:pl-4 [&_input.block]:text-[15px] [&_input.block]:text-mk-text [&_input.block]:shadow-none",
  "[&_input.block::placeholder]:text-mk-dim [&_input.block:focus]:border-mk-accent [&_input.block:focus]:ring-2 [&_input.block:focus]:ring-mk-accent/30 [&_input.block[aria-invalid=true]]:border-red-500/70",
  // Sign-in method tabs → dark segmented control with an orange active segment.
  "[&_[role=tablist]]:rounded-full [&_[role=tablist]]:border [&_[role=tablist]]:border-mk-line [&_[role=tablist]]:bg-mk-elev-1 [&_[role=tablist]]:p-1",
  "[&_[role=tab]]:min-h-10 [&_[role=tab]]:rounded-full [&_[role=tab]]:text-mk-muted [&_[role=tab]:hover]:text-mk-text [&_[role=tab][aria-selected=true]]:bg-mk-accent [&_[role=tab][aria-selected=true]]:text-mk-accent-ink [&_[role=tab][aria-selected=true]]:shadow-[0_8px_24px_-10px_var(--accent-glow)]",
  // Banners (FormMessage) and soft panels a touch rounder on dark.
  "[&_[role=alert].rounded-md]:rounded-[var(--r-sm)] [&_[role=status].rounded-md]:rounded-[var(--r-sm)]",
].join(" ");

/**
 * Split authentication layout for platform users, in the marketing site's dark editorial look.
 * Left (lg+): elevated brand panel with the orange glow (logo, headline, value bullets). Right: the
 * form on the page background. Below lg the panel collapses to a compact logo header.
 * Both merchant and console sign-in use the Pictocart brand; copy and form behaviour differ by route.
 */
export function AuthSplit({ variant, aside, children, back }: { variant: "merchant" | "console"; aside: ReactNode; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div data-theme="dark" className="flex min-h-dvh flex-1 flex-col">
      <OnboardingTheme className="flex flex-1 flex-col">
        <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <aside className="relative hidden overflow-hidden border-r border-mk-line bg-mk-elev-1 lg:flex">
            <div aria-hidden className="mk-grid-texture pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(80%_70%_at_30%_20%,black,transparent)]" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_80%_8%,rgb(234_88_12/0.22),transparent_70%),radial-gradient(45%_40%_at_8%_95%,rgb(234_88_12/0.12),transparent_70%)]"
            />
            <div className="relative z-10 flex w-full flex-col items-start gap-10 p-10 xl:p-14 2xl:p-16">{aside}</div>
          </aside>
          <main className="flex min-w-0 flex-col px-4 py-4 sm:px-10 sm:py-6 lg:px-12 xl:px-16">
            <div className="flex min-h-10 items-center justify-between gap-4">
              <span className="lg:hidden">
                <BrandLogo tone="light" chip />
              </span>
              {back ? (
                <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-mk-muted transition-colors hover:text-mk-text">
                  <ArrowLeft aria-hidden className="size-4" /> {back.label}
                </Link>
              ) : (
                <span className="hidden font-mk-mono text-[11px] uppercase tracking-[0.18em] text-mk-dim sm:inline lg:hidden">
                  {variant === "console" ? "Platform console" : "Built for independent businesses"}
                </span>
              )}
            </div>
            <div data-auth-variant={variant} className={`mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8 sm:py-10 lg:py-12 ${AUTH_FORM_SKIN}`}>
              {children}
            </div>
            <footer className="flex flex-wrap justify-between gap-2 border-t border-mk-line pt-4 text-xs text-mk-dim">
              <span>
                © {new Date().getFullYear()} {PLATFORM_NAME}
              </span>
              <span className="flex gap-4">
                <Link href="/terms" className="transition-colors hover:text-mk-text">
                  Terms
                </Link>
                <Link href="/privacy" className="transition-colors hover:text-mk-text">
                  Privacy
                </Link>
              </span>
            </footer>
          </main>
        </div>
      </OnboardingTheme>
    </div>
  );
}

/** Heading block shared by all auth forms. */
export function AuthHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow ? <OnbEyebrow className="mb-3">{eyebrow}</OnbEyebrow> : null}
      <OnbHeading>{title}</OnbHeading>
      {description ? <OnbSub className="mt-3">{description}</OnbSub> : null}
    </div>
  );
}
