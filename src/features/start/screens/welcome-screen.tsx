"use client";

import { cn } from "@/lib/cn";
import { startCopy } from "../copy";

const FLOATING = [
  {
    title: "Kota Doria Saree",
    meta: "₹2,190 · written by AI",
    rotate: "-8deg",
    pos: "left-[2%] top-[8%] hidden lg:block",
    grad: "from-[#F472B6] to-[#FB923C]",
  },
  {
    title: "Brass Aarti Diya",
    meta: "₹520 · SEO ready",
    rotate: "7deg",
    pos: "right-[2%] top-[6%] hidden lg:block",
    grad: "from-[#FCD34D] to-[#B45309]",
  },
  {
    title: "Whole Spices Box",
    meta: "From your shelf to the web",
    rotate: "5deg",
    pos: "left-[4%] bottom-[14%] hidden lg:block",
    grad: "from-[#FDBA74] to-[#C2410C]",
  },
] as const;

export function WelcomeScreen({ locale, onBegin }: { locale: string; onBegin: () => void }) {
  const c = startCopy(locale);
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 pt-6 text-center sm:gap-7">
      {FLOATING.map((card) => (
        <div
          key={card.title}
          aria-hidden
          className={cn(
            "absolute w-36 rounded-2xl bg-white/82 p-2.5 text-left shadow-[0_24px_50px_-20px_rgba(80,50,120,0.35)] motion-safe:animate-[startFloat_7s_ease-in-out_infinite]",
            card.pos,
          )}
          style={{ transform: `rotate(${card.rotate})` }}
        >
          <div className={cn("h-28 rounded-[10px] bg-linear-to-br", card.grad)} />
          <p className="mt-2 text-xs font-semibold">{card.title}</p>
          <p className="text-[11.5px] text-[#C2410C]">{card.meta}</p>
        </div>
      ))}
      <div className="relative size-24">
        <div className="absolute -inset-6 rounded-full bg-[conic-gradient(from_0deg,#FFB98A,#FDBA74,#FFE8D2,#FFB98A)] opacity-75 blur-[22px] motion-safe:animate-[startSpin_12s_linear_infinite]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#F97316_100%)] shadow-[inset_-10px_-16px_36px_rgba(194,65,12,0.28),0_20px_60px_-10px_rgba(249,115,22,0.45)] motion-safe:animate-[startBreathe_4s_ease-in-out_infinite]" />
      </div>
      <h1 className="max-w-xl font-brand text-4xl font-normal leading-[1.1] tracking-tight text-balance sm:text-6xl lg:text-7xl">
        {c.welcome.headline}
        <span className="italic text-[#C2410C]">{c.welcome.headlineAccent}</span>
        {c.welcome.headlineEnd}
      </h1>
      <p className="max-w-lg text-base leading-relaxed text-[#5E5568] sm:text-lg">{c.welcome.sub}</p>
      <button
        type="button"
        onClick={onBegin}
        className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-8 py-4 text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)]"
      >
        {c.welcome.cta}
      </button>
      <p className="flex flex-wrap justify-center gap-3 text-sm text-[#6B6275]">
        {c.welcome.features.map((f) => (
          <span key={f}>· {f}</span>
        ))}
      </p>
      <div
        className="absolute bottom-[12%] right-[3%] hidden items-center gap-2 rounded-full bg-white/88 px-3.5 py-2.5 text-sm shadow-[0_18px_40px_-18px_rgba(80,50,120,0.35)] lg:flex"
        aria-hidden
      >
        <span className="size-2 rounded-full bg-[#22C55E]" />
        {c.welcome.orderToast}
      </div>
    </section>
  );
}
