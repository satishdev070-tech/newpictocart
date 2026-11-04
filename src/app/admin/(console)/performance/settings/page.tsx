import type { Metadata } from "next";
import { requirePlatform } from "@/lib/platform/access";
import { Card, PageHeader } from "@/components/ui/layout";
import { SettingsForm } from "@/features/observability/components/settings-form";
import { getObservabilitySettings } from "@/features/observability/server/queries";

export const metadata: Metadata = { title: "Monitoring settings" };

const EDITABLE_KEYS = [
  "sample_rate",
  "slow_ms",
  "retention_days",
  "metrics_retention_days",
  "enabled",
] as const;

function jsonDefault(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function PerformanceSettingsPage() {
  await requirePlatform("platform.observability.manage");
  const { env, db } = await getObservabilitySettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring settings"
        description="Environment flags (read-only) and observability_settings rows (editable). Updates require platform.observability.manage."
      />

      <Card title="Environment (deployment)">
        <dl className="grid gap-2 text-small sm:grid-cols-2">
          <div>
            <dt className="text-muted">OBSERVABILITY_ENABLED</dt>
            <dd className="font-mono">{String(env.enabled)}</dd>
          </div>
          <div>
            <dt className="text-muted">Sample rate</dt>
            <dd className="font-mono">{env.sampleRate}</dd>
          </div>
          <div>
            <dt className="text-muted">Slow threshold (ms)</dt>
            <dd className="font-mono">{env.slowMs}</dd>
          </div>
          <div>
            <dt className="text-muted">Retention (events / metrics days)</dt>
            <dd className="font-mono">
              {env.retentionDays} / {env.metricsRetentionDays}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-caption text-muted">
          Env values are set at deploy time. DB rows below can override operational knobs for the admin UI /
          cleanup RPC when the migration seeds them — they do not replace process.env for ingest sampling.
        </p>
      </Card>

      <Card title="observability_settings" description="Key/value store (jsonb). Save writes via admin client after permission check.">
        <ul className="space-y-4">
          {EDITABLE_KEYS.map((key) => (
            <li key={key}>
              <SettingsForm settingKey={key} defaultValue={jsonDefault(db[key] ?? "")} />
            </li>
          ))}
        </ul>
        {Object.keys(db).filter((k) => !(EDITABLE_KEYS as readonly string[]).includes(k)).length > 0 ? (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-3 text-caption text-muted">Additional keys present in DB:</p>
            <ul className="space-y-4">
              {Object.keys(db)
                .filter((k) => !(EDITABLE_KEYS as readonly string[]).includes(k))
                .sort()
                .map((key) => (
                  <li key={key}>
                    <SettingsForm settingKey={key} defaultValue={jsonDefault(db[key])} />
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
