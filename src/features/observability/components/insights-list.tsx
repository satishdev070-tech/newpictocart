import Link from "next/link";
import { Badge, Card } from "@/components/ui/layout";
import type { PerformanceInsight } from "@/features/observability/server/insights";

const TONE = {
  info: "info",
  warning: "warning",
  critical: "error",
} as const;

export function InsightsList({ insights }: { insights: PerformanceInsight[] }) {
  return (
    <ul className="space-y-3">
      {insights.map((insight) => (
        <li key={insight.id}>
          <Card
            title={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[insight.severity]}>{insight.severity}</Badge>
                <span>{insight.title}</span>
              </span>
            }
            actions={
              insight.href ? (
                <Link href={insight.href} className="text-small text-accent hover:underline">
                  Open
                </Link>
              ) : null
            }
          >
            <p className="text-small text-muted">{insight.detail}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
