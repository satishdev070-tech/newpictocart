"use client";

import { cn } from "@/lib/cn";

export function TaraOrb({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "size-36 sm:size-44" : size === "sm" ? "size-20" : "size-28 sm:size-32";
  return (
    <div className={cn("relative", dim, className)}>
      <div className="absolute -inset-6 rounded-full bg-[conic-gradient(from_0deg,#FFB98A,#FDBA74,#FFE8D2,#FFB98A)] opacity-75 blur-[22px] motion-safe:animate-[startSpin_12s_linear_infinite]" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#F97316_100%)] shadow-[inset_-10px_-16px_36px_rgba(194,65,12,0.28),0_20px_60px_-10px_rgba(249,115,22,0.45)] motion-safe:animate-[startBreathe_4s_ease-in-out_infinite]" />
    </div>
  );
}
