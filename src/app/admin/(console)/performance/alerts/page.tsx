import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import { AcknowledgeIncidentButton, ToggleAlertRuleButton } from "@/features/observability/components/alert-actions";
import { CreateAlertRuleForm } from "@/features/observability/components/create-alert-rule-form";
import { EmptyTelemetry } from "@/features/observability/components/empty-telemetry";
import { listAlertEvents, listAlertRules, listIncidents } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Alerts & incidents" };

export default async function PerformanceAlertsPage() {
  const ctx = await requirePlatform("platform.observability.read");
  const canManage = ctx.permissions.has("platform.observability.manage");
  const [rules, incidents, events] = await Promise.all([listAlertRules(), listIncidents(), listAlertEvents(50)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & incidents"
        description="Rules, open incidents, and recent alert firings. Mutations require platform.observability.manage."
      />

      {canManage ? (
        <Card title="Create alert rule" description="Gated by platform.observability.manage.">
          <CreateAlertRuleForm />
        </Card>
      ) : null}

      <Card title="Alert rules" description={`${rules.length} rule${rules.length === 1 ? "" : "s"}`}>
        {rules.length === 0 ? (
          <p className="text-small text-muted">No alert rules configured yet.</p>
        ) : (
          <Table caption="Alert rules">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Enabled</th>
                <th className={th}>Updated</th>
                {canManage ? (
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.name}</td>
                  <td className={td}>
                    <code className="text-caption">{r.ruleType}</code>
                  </td>
                  <td className={td}>
                    <Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "on" : "off"}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(r.updatedAt)}</td>
                  {canManage ? (
                    <td className={td}>
                      <ToggleAlertRuleButton id={r.id} enabled={r.enabled} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Incidents" description="Newest first">
        {incidents.length === 0 ? (
          <EmptyTelemetry title="No incidents" />
        ) : (
          <Table caption="Incidents">
            <thead>
              <tr>
                <th className={th}>Title</th>
                <th className={th}>Status</th>
                <th className={th}>Opened</th>
                <th className={th}>Resolved</th>
                {canManage ? (
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    <p className="font-medium">{i.title}</p>
                    {i.summary ? <p className="mt-0.5 max-w-xl truncate text-caption text-muted">{i.summary}</p> : null}
                  </td>
                  <td className={td}>
                    <Badge tone={i.status === "open" ? "error" : i.status === "acknowledged" ? "warning" : "success"}>
                      {i.status}
                    </Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(i.openedAt)}</td>
                  <td className={`${td} whitespace-nowrap text-caption`}>
                    {i.resolvedAt ? formatDateTime(i.resolvedAt) : "—"}
                  </td>
                  {canManage ? (
                    <td className={td}>{i.status === "open" ? <AcknowledgeIncidentButton incidentId={i.id} /> : null}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Recent alert events">
        {events.length === 0 ? (
          <p className="text-small text-muted">No alert events yet.</p>
        ) : (
          <Table caption="Alert events">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Severity</th>
                <th className={th}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap text-caption`}>{formatDateTime(e.firedAt)}</td>
                  <td className={td}>
                    <Badge tone={e.severity === "critical" ? "error" : e.severity === "warning" ? "warning" : "info"}>
                      {e.severity}
                    </Badge>
                  </td>
                  <td className={td}>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
