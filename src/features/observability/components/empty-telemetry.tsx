import { EmptyState } from "@/components/ui/states";
import { NO_TELEMETRY_YET } from "@/features/observability/constants";

export function EmptyTelemetry({ title = "No telemetry yet" }: { title?: string }) {
  return <EmptyState title={title} description={NO_TELEMETRY_YET} />;
}
