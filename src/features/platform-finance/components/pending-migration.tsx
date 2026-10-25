import { Card } from "@/components/ui/layout";

/** Shown instead of a finance page while migration 3700 (platform finance) is not applied. */
export function PendingMigrationNotice({ what }: { what: string }) {
  return (
    <Card title="Pending migration">
      <p className="text-small text-muted">
        {what} needs the platform finance migration (<code className="font-mono text-caption">20261025003700_platform_finance.sql</code>), which is not applied to this database yet. Apply it, then reload this page.
      </p>
    </Card>
  );
}
