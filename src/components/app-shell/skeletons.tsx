import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/states";

/**
 * Route-level loading fallbacks for the panels (used by loading.tsx files). Each segment with its
 * own boundary renders instantly on click and is prefetched up to that boundary, so the sidebar
 * never waits on the next page's data. Shapes follow the page types so content doesn't jump.
 */

function Header({ actions = true }: { actions?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {actions ? <Skeleton className="h-9 w-32 rounded-lg" /> : null}
    </div>
  );
}

function Busy({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** List pages: filters + table. */
export function TablePageSkeleton() {
  return (
    <Busy>
      <Header />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Skeleton className="h-10 rounded-none" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border px-4 py-3.5">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Settings and editor pages: stacked form cards. */
export function FormPageSkeleton() {
  return (
    <Busy>
      <Header actions={false} />
      <div className="space-y-6">
        {[4, 3].map((rows, c) => (
          <div key={c} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="mb-5 h-5 w-40" />
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Media, themes and other card grids. */
export function GridPageSkeleton() {
  return (
    <Busy>
      <Header />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

const TINTS = ["border-tint-mint-border bg-tint-mint", "border-tint-lavender-border bg-tint-lavender", "border-tint-peach-border bg-tint-peach", "border-tint-rose-border bg-tint-rose"];

/** Dashboard home and the console overview: hero, tinted KPI cards, charts. */
export function OverviewSkeleton() {
  return (
    <Busy>
      <Header />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TINTS.map((t) => (
          <div key={t} className={`rounded-xl border p-5 ${t}`}>
            <Skeleton className="mb-4 size-9 rounded-lg bg-surface/70" />
            <Skeleton className="mb-2 h-3 w-24 bg-surface/70" />
            <Skeleton className="h-7 w-20 bg-surface/70" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </Busy>
  );
}
