"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  PenLine,
  ScanSearch,
  Upload,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type AiGenerationStep = {
  id: string;
  label: string;
  /** Lucide (or compatible) icon shown while the step is active / upcoming. */
  icon: ComponentType<LucideProps>;
};

export type AiGenerationProgressStatus = "idle" | "pending" | "success" | "error";

type StepState = "upcoming" | "active" | "done" | "error";

/**
 * Staged progress for seller AI generations. While `pending`, steps advance on a timer with an
 * animated bar; on `success` every step is done; on `error` the active step fails. Hidden when idle.
 * Reusable across product generate, blog write, store setup, etc.
 */
export function AiGenerationProgress({
  steps,
  status,
  className,
  /** ms spent on each intermediate step before advancing (last step waits until status changes). */
  stepMs = 1_400,
}: {
  steps: readonly AiGenerationStep[];
  status: AiGenerationProgressStatus;
  className?: string;
  stepMs?: number;
}) {
  /** Ticks elapsed while pending (advanced only from the interval callback). */
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    if (status !== "pending") return;
    const lastAdvanceable = Math.max(0, steps.length - 2);
    const id = window.setInterval(() => {
      setTicks((t) => (t >= lastAdvanceable ? t : t + 1));
    }, stepMs);
    return () => window.clearInterval(id);
  }, [status, steps.length, stepMs]);

  // Remount-friendly reset: when a new pending run starts, bump via a deferred write so the
  // effect body itself never calls setState synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (status !== "pending") return;
    const kick = window.setTimeout(() => setTicks(0), 0);
    return () => window.clearTimeout(kick);
  }, [status]);

  if (status === "idle" || steps.length === 0) return null;

  const activeIndex =
    status === "success" ? Math.max(0, steps.length - 1) : Math.min(ticks, Math.max(0, steps.length - 1));

  const stateFor = (i: number): StepState => {
    if (status === "success") return "done";
    if (status === "error") {
      if (i < activeIndex) return "done";
      if (i === activeIndex) return "error";
      return "upcoming";
    }
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "upcoming";
  };

  const filled =
    status === "success"
      ? 1
      : status === "error"
        ? (activeIndex + 0.35) / steps.length
        : Math.min(0.92, (activeIndex + 0.45) / steps.length);

  const liveLabel =
    status === "success"
      ? "Generation complete"
      : status === "error"
        ? "Generation failed"
        : `${steps[activeIndex]?.label ?? "Working"}…`;

  return (
    <div
      className={cn("space-y-3 rounded-lg border border-border bg-surface-secondary/40 px-3 py-3", className)}
      role="status"
      aria-live="polite"
      aria-busy={status === "pending"}
    >
      <p className="text-caption font-medium text-muted">{liveLabel}</p>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled * 100)}
        aria-label="Generation progress"
      >
        <div
          className={cn(
            "h-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-out motion-reduce:transition-none",
            status === "error" ? "bg-error" : status === "success" ? "bg-success" : "bg-accent-strong",
            status === "pending" && "motion-safe:animate-pulse",
          )}
          style={{ transform: `scaleX(${filled})` }}
        />
      </div>

      <ol className={cn("grid gap-2", steps.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
        {steps.map((step, i) => {
          const state = stateFor(i);
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors",
                  state === "done" && "bg-success/15 text-success ring-success/25",
                  state === "active" && "bg-accent-soft text-accent ring-accent/30",
                  state === "error" && "bg-error/10 text-error ring-error/25",
                  state === "upcoming" && "bg-surface text-muted ring-border",
                )}
                aria-hidden
              >
                {state === "done" ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : state === "error" ? (
                  <CircleAlert className="size-3.5" />
                ) : state === "active" ? (
                  <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>
              <span
                className={cn(
                  "truncate text-caption",
                  state === "active" && "font-medium text-foreground",
                  state === "done" && "text-success",
                  state === "error" && "font-medium text-error",
                  state === "upcoming" && "text-muted",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Default product-from-image stages (Upload → Analyze → Write → Done). */
export const PRODUCT_GENERATE_STEPS: readonly AiGenerationStep[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "analyze", label: "Analyze", icon: ScanSearch },
  { id: "write", label: "Write", icon: PenLine },
  { id: "done", label: "Done", icon: Check },
];

/** Blog AI Write stages. */
export const BLOG_WRITE_STEPS: readonly AiGenerationStep[] = [
  { id: "topic", label: "Topic", icon: ScanSearch },
  { id: "write", label: "Write", icon: PenLine },
  { id: "apply", label: "Apply", icon: Check },
];

/** Generate AI Reviews stages. */
export const GENERATE_REVIEWS_STEPS: readonly AiGenerationStep[] = [
  { id: "product", label: "Product", icon: ScanSearch },
  { id: "write", label: "Write", icon: PenLine },
  { id: "save", label: "Save", icon: Check },
];
