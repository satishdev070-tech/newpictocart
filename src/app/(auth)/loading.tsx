import { Skeleton } from "@/components/ui/states";

/** Instant shell while /login or /seller/login resolve session + Google availability. */
export default function AuthLoading() {
  return (
    <div data-theme="light" className="theme-brand bg-brand-canvas grid min-h-dvh flex-1 lg:grid-cols-[3fr_2fr]">
      <aside className="relative hidden overflow-hidden bg-brand-soft lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_12%_88%,rgba(249,115,22,0.12),transparent_36%)]" />
      </aside>
      <main className="flex min-w-0 flex-col bg-surface px-6 py-6 sm:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-10">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </main>
    </div>
  );
}
