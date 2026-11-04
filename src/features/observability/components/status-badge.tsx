import { Badge } from "@/components/ui/layout";
import { classifyDuration, type DurationClass } from "@/lib/observability/thresholds";

const DURATION_TONE: Record<DurationClass, "success" | "warning" | "error" | "info"> = {
  healthy: "success",
  moderate: "info",
  slow: "warning",
  critical: "error",
};

const DURATION_LABEL: Record<DurationClass, string> = {
  healthy: "healthy",
  moderate: "moderate",
  slow: "slow",
  critical: "critical",
};

export function DurationBadge({ ms }: { ms: number }) {
  const cls = classifyDuration(ms);
  return (
    <Badge tone={DURATION_TONE[cls]}>
      {Math.round(ms)} ms · {DURATION_LABEL[cls]}
    </Badge>
  );
}

export function HttpStatusBadge({ status }: { status: number }) {
  const tone = status >= 500 ? "error" : status >= 400 ? "warning" : status >= 300 ? "info" : "success";
  return <Badge tone={tone}>{status}</Badge>;
}
