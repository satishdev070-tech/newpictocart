import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * GET filter form for list pages (works without JavaScript; state lives in the URL).
 * Below `md` the fields fold behind a "Filters" toggle (a CSS-only checkbox) so the list
 * itself is near the top on phones; `active` opens it when filters are applied.
 */
export function FilterBar({ action, resetHref, children, label = "Filters", active = false }: { action: string; resetHref: string; children: ReactNode; label?: string; active?: boolean }) {
  return (
    <form method="get" action={action} role="search" aria-label={label} data-tour="filters" className="mb-4 rounded-lg border border-border bg-surface p-2 md:p-4">
      <input type="checkbox" id={`${action}-filters-toggle`} className="peer sr-only" defaultChecked={active} />
      <label
        htmlFor={`${action}-filters-toggle`}
        className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-small font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-accent md:hidden"
      >
        <span>
          Filters{active ? <span className="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-caption text-accent">on</span> : null}
        </span>
        <span aria-hidden className="text-muted">
          ▾
        </span>
      </label>
      <div className="hidden p-2 peer-checked:block md:block md:p-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" size="sm" className="min-h-11 md:min-h-8">
            Apply filters
          </Button>
          <Link href={resetHref} className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline">
            Reset
          </Link>
        </div>
      </div>
    </form>
  );
}

/** Builds a query string from defined values (for export links and pagination params). */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
