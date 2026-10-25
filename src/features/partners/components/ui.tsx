import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/layout";
import { cn } from "@/lib/cn";

/** Shown instead of a page body while migration 3800 is not applied. */
export function PendingMigrationNotice({ what = "The partner programme" }: { what?: string }) {
  return (
    <p role="status" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">
      {what} needs the pending database migration <code className="font-mono">20261025003800_partners.sql</code>. Apply it to the project and reload this page.
    </p>
  );
}

/** Link-based tabs (state lives in the URL so tabs are shareable and work without JS). */
export function TabNav({ tabs, active, label }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={cn("inline-flex h-10 items-center border-b-2 px-3 text-small font-medium", t.key === active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const TONES: Record<string, "success" | "warning" | "error" | "neutral" | "info" | "accent"> = {
  active: "success",
  pending: "warning",
  suspended: "error",
  available: "info",
  consumed: "success",
  revoked: "neutral",
  approved: "success",
  rejected: "error",
  paid: "success",
  initiated: "warning",
  failed: "error",
  batched: "accent",
  void: "neutral",
  used: "success",
  expired: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? "neutral"}>{status[0]?.toUpperCase() + status.slice(1)}</Badge>;
}

export const searchInput = "h-9 rounded-md border border-border bg-surface px-3 text-small";
