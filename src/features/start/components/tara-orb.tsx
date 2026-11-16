"use client";

import { cn } from "@/lib/cn";

/** Tara's orb on the dark onboarding surface: brand-orange core, soft glow (CSS-only, motion-safe). */
export function TaraOrb({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "size-36 sm:size-44" : size === "sm" ? "size-16" : "size-28 sm:size-32";
  return (
    <div className={cn("relative", dim, className)} aria-hidden>
      <div className="absolute -inset-4 rounded-full bg-[conic-gradient(from_0deg,rgb(234_88_12/0.55),rgb(251_146_60/0.25),rgb(234_88_12/0.05),rgb(234_88_12/0.55))] opacity-80 blur-[18px] motion-safe:animate-[startSpin_12s_linear_infinite]" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff7ed_0,#fdba74_24%,var(--mk-accent)_62%,var(--mk-accent-hover)_100%)] shadow-[inset_-8px_-14px_30px_rgb(0_0_0/0.25),0_16px_48px_-12px_var(--accent-glow)] motion-safe:animate-[startBreathe_4s_ease-in-out_infinite]" />
    </div>
  );
}
