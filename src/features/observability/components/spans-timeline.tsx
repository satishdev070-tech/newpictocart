import { Badge } from "@/components/ui/layout";
import type { SpanRecord } from "@/lib/observability/request-context";
import { DurationBadge } from "./status-badge";

function spanDuration(s: SpanRecord): number {
  return Math.max(0, (s.endMs ?? s.startMs) - s.startMs);
}

export function SpansTimeline({ spans, totalMs }: { spans: SpanRecord[]; totalMs: number }) {
  if (spans.length === 0) {
    return <p className="text-small text-muted">No spans recorded on this event.</p>;
  }
  const minStart = Math.min(...spans.map((s) => s.startMs));
  const maxEnd = Math.max(...spans.map((s) => s.endMs ?? s.startMs), minStart + Math.max(totalMs, 1));
  const window = Math.max(1, maxEnd - minStart);

  return (
    <ol className="space-y-3">
      {spans.map((s, i) => {
        const dur = spanDuration(s);
        const left = ((s.startMs - minStart) / window) * 100;
        const width = Math.max(0.5, (dur / window) * 100);
        return (
          <li key={`${s.name}-${i}`} className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-small font-medium">{s.name}</code>
                <Badge tone={s.status === "error" ? "error" : "neutral"}>{s.status}</Badge>
              </div>
              <DurationBadge ms={dur} />
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-surface-secondary">
              <div
                className={s.status === "error" ? "absolute inset-y-0 rounded-full bg-error/70" : "absolute inset-y-0 rounded-full bg-accent/70"}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
