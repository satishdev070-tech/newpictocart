"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * CSS marquee. Children are duplicated for a seamless -50% loop.
 * Pauses on hover; reduced-motion shows a static wrap (no animation).
 */
export function Marquee({
  children,
  className,
  reverse = false,
  speed = 40,
  pauseOnHover = true,
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
  /** Seconds for one full cycle. */
  speed?: number;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/marquee relative overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-max",
          reverse ? "animate-[marquee-reverse_var(--mk-marquee-dur)_linear_infinite]" : "animate-[marquee_var(--mk-marquee-dur)_linear_infinite]",
          pauseOnHover && "group-hover/marquee:[animation-play-state:paused]",
          "motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:w-full motion-reduce:justify-center motion-reduce:gap-x-8 motion-reduce:gap-y-3",
        )}
        style={{ ["--mk-marquee-dur" as string]: `${speed}s` }}
      >
        <div className="flex shrink-0 items-center gap-8 px-4 motion-reduce:flex-wrap motion-reduce:justify-center">{children}</div>
        <div className="flex shrink-0 items-center gap-8 px-4 motion-reduce:hidden" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
