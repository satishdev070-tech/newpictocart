import Link from "next/link";
import type { ReactNode } from "react";

export type OnboardingLogo = { src: string; width: number | null; height: number | null; name: string };

/** Visual vocabulary of /start (warm cream + orange), with AA-contrast accents. */
export const ui = {
  primaryBtn:
    "inline-flex min-h-12 items-center justify-center rounded-full bg-[#C2410C] px-7 py-3 text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(194,65,12,0.55)] hover:bg-[#9A3412] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2410C] disabled:cursor-not-allowed disabled:opacity-60",
  ghostBtn: "inline-flex min-h-11 items-center text-sm font-medium text-[#5E5568] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#C2410C]",
  input:
    "mt-1 block min-h-11 w-full rounded-xl border border-[#2A2233]/20 bg-white px-3 py-2 text-[#2A2233] placeholder:text-[#6B6275] focus:border-[#C2410C] focus:outline-2 focus:outline-[#C2410C]/30",
  label: "block text-sm font-semibold text-[#2A2233]",
  error: "mt-1 text-sm text-[#B42318]",
  hint: "mt-1 text-sm text-[#5E5568]",
  card: "rounded-3xl border border-white/90 bg-white/80 p-5 shadow-[0_20px_50px_-30px_rgba(42,34,51,0.35)] backdrop-blur-md sm:p-8",
};

const STEP_NUMBER: Record<string, number> = { "basic-info": 1, theme: 2, services: 3, account: 4 };

export function InformativeShell({ logo, step, children, wide = false }: { logo: OnboardingLogo; step: string | null; children: ReactNode; wide?: boolean }) {
  const n = step ? STEP_NUMBER[step] : undefined;
  return (
    <div className="relative min-h-dvh bg-[#FBF6F1] text-[#2A2233]">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#C2410C]">
          {/* eslint-disable-next-line @next/next/no-img-element -- platform logo, same as /start */}
          {logo.src ? <img src={logo.src} alt={logo.name} width={logo.width ?? 120} height={logo.height ?? 32} className="h-8 w-auto" /> : <span className="font-semibold">{logo.name}</span>}
        </Link>
        {n ? (
          <div className="w-40 sm:w-56" aria-label={`Step ${n} of 4`}>
            <p className="mb-1 text-right text-xs font-medium text-[#5E5568]">Step {n} of 4</p>
            <div className="h-1.5 rounded-full bg-[#2A2233]/10" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={n} aria-label="Progress">
              <div className="h-1.5 rounded-full bg-[#C2410C]" style={{ width: `${n * 25}%` }} />
            </div>
          </div>
        ) : null}
      </header>
      <main id="main" className={`mx-auto w-full px-4 pt-4 pb-16 sm:px-8 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>{children}</main>
    </div>
  );
}
