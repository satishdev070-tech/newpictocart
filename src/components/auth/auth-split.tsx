import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PLATFORM_NAME } from "@/config/platform";
import { BrandLogo } from "@/features/marketing-site/components/brand-logo";

/**
 * Split authentication layout for platform users. The left panel carries brand/value content
 * (hidden below lg, where a compact brand row replaces it); the right panel holds the form.
 * Both merchant and console sign-in use the Pictocart brand; copy and form behaviour differ by route.
 */
export function AuthSplit({ variant, aside, children, back }: { variant: "merchant" | "console"; aside: ReactNode; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div data-theme="light" className="theme-brand bg-brand-canvas grid min-h-dvh flex-1 lg:grid-cols-[3fr_2fr]">
      <aside className="relative hidden overflow-hidden bg-brand-soft lg:flex">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_12%_88%,rgba(249,115,22,0.12),transparent_36%)]" />
        <div className="relative z-10 flex w-full flex-col items-start gap-8 p-10 text-brand-ink xl:p-14 2xl:p-16">{aside}</div>
      </aside>
      <main className="flex min-w-0 flex-col bg-surface px-6 py-6 sm:px-10 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between gap-4">
          {back ? (
            <Link href={back.href} className="inline-flex items-center gap-1.5 text-small text-muted hover:text-foreground">
              <ArrowLeft aria-hidden className="size-4" /> {back.label}
            </Link>
          ) : (
            <span className="lg:invisible">
              <BrandLogo />
            </span>
          )}
        </div>
        <div data-auth-variant={variant} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 lg:py-12">
          {children}
        </div>
        <footer className="flex flex-wrap justify-between gap-2 text-caption text-subtle">
          <span>
            © {new Date().getFullYear()} {PLATFORM_NAME}
          </span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}

/** Heading block shared by all auth forms. */
export function AuthHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow ? <p className="mb-2 text-overline text-accent">{eyebrow}</p> : null}
      <h1 className="text-h1">{title}</h1>
      {description ? <p className="mt-2 text-body text-muted">{description}</p> : null}
    </div>
  );
}
