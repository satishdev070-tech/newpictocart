import Link from "next/link";
import { cn } from "@/lib/cn";

const RANGES = [
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
] as const;

export function TimeRangeLinks({
  basePath,
  active,
  extraParams,
}: {
  basePath: string;
  active: string;
  extraParams?: Record<string, string | undefined>;
}) {
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Time range">
      {RANGES.map((r) => {
        const p = new URLSearchParams();
        p.set("range", r.key);
        if (extraParams) {
          for (const [k, v] of Object.entries(extraParams)) if (v) p.set(k, v);
        }
        const href = `${basePath}?${p}`;
        const isActive = active === r.key;
        return (
          <Link
            key={r.key}
            href={href}
            className={cn(
              "rounded-md px-2.5 py-1 text-small font-medium ring-1 ring-inset transition-colors",
              isActive ? "bg-accent-soft text-accent ring-accent/30" : "bg-surface text-muted ring-border hover:bg-surface-secondary",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function activeRangeKey(range: string | null | undefined): string {
  const v = (range ?? "24h").trim().toLowerCase();
  return RANGES.some((r) => r.key === v) ? v : "24h";
}
