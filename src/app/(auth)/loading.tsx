import { OnboardingTheme } from "@/components/onboarding-ui";

const bar = "animate-pulse bg-white/[0.06] motion-reduce:animate-none";

/** Instant dark shell while /login or /seller/login resolve session + Google availability (matches AuthSplit). */
export default function AuthLoading() {
  return (
    <div data-theme="dark" className="flex min-h-dvh flex-1 flex-col">
      <OnboardingTheme className="flex flex-1 flex-col">
        <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <aside className="relative hidden overflow-hidden border-r border-mk-line bg-mk-elev-1 lg:block" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_80%_8%,rgb(234_88_12/0.22),transparent_70%),radial-gradient(45%_40%_at_8%_95%,rgb(234_88_12/0.12),transparent_70%)]" />
          </aside>
          <main className="flex min-w-0 flex-col px-4 py-4 sm:px-10 sm:py-6 lg:px-12 xl:px-16" aria-busy="true">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-10" aria-hidden>
              <div className={`${bar} h-3 w-20 rounded-full`} />
              <div className={`${bar} h-9 w-64 rounded-[var(--r-sm)]`} />
              <div className={`${bar} h-4 w-full rounded-full`} />
              <div className={`${bar} mt-4 h-12 w-full rounded-full`} />
              <div className={`${bar} h-12 w-full rounded-[var(--r-sm)]`} />
              <div className={`${bar} h-12 w-full rounded-full`} />
            </div>
          </main>
        </div>
      </OnboardingTheme>
    </div>
  );
}
