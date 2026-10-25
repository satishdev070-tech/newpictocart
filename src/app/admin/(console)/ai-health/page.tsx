import type { Metadata } from "next";
import { Badge, Card, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { formatMoney } from "@/lib/money";
import { requirePlatform } from "@/lib/platform/access";
import { AI_FEATURES, ENGINE_LABELS } from "@/features/ai-health/registry";
import { aiHealthTab } from "@/features/ai-health/schemas";
import { getAiHealthOverview } from "@/features/ai-health/server";
import { TabNav } from "@/features/ai-health/tab-nav";
import { EditRouteDialog, ModelPriceDialog, PriceCell, ResetRouteButton, RouteSummary, TestModelButton } from "@/features/ai-health/components";
import { AI_PROVIDERS, PROVIDER_LABELS, type AiProvider } from "@/features/neural-pulse/schemas";

export const metadata: Metadata = { title: "AI health" };

const TABS = [
  { key: "features", label: "Features" },
  { key: "models", label: "Models" },
] as const;

const PROVIDER_NAMES: Record<string, string> = { ...PROVIDER_LABELS, sarvam: "Sarvam AI" };
const isLlm = (p: string): p is AiProvider => (AI_PROVIDERS as readonly string[]).includes(p);
const nf = new Intl.NumberFormat("en-IN");

export default async function AiHealthPage({ searchParams }: PageProps<"/admin/ai-health">) {
  const ctx = await requirePlatform("platform.settings.manage");
  const tab = aiHealthTab((await searchParams).tab);
  const o = await getAiHealthOverview(ctx);
  const defaults = Object.fromEntries(o.providers.map((p) => [p.id, p.defaultModel]));
  const configured = new Set(o.providers.filter((p) => p.configured).map((p) => p.id));

  return (
    <div className="space-y-6">
      <PageHeader title="AI health" description="Every AI feature in the app, the provider and model each one uses, live provider checks and token cost per model." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="mint" label="AI-powered features" value={o.stats.features} hint={`${AI_FEATURES.filter((f) => f.routable).length} with an editable route`} />
        <StatCard tone="lavender" label="APIs connected" value={`${o.stats.apisConnected} / ${o.stats.apisTotal}`} hint={o.providers.map((p) => `${PROVIDER_NAMES[p.id]} ${p.configured ? "✓" : "✗"}`).join(" · ")} />
        <StatCard tone="peach" label="Unique models" value={o.stats.uniqueModels} hint="In routes, defaults and logged calls" />
        <StatCard tone="sky" label="Logged calls (30 days)" value={nf.format(o.stats.calls30d)} hint={`${nf.format(o.stats.tokens30d)} tokens · ${formatMoney(o.stats.costMinor30d)} cost`} />
      </div>
      {!o.available ? (
        <Card title="Pending migration">
          <p className="text-small text-muted">
            Routes, model prices and usage need migration <code className="font-mono text-caption">20261025003900_ai_economy.sql</code> (and 3700). Until it is applied every feature uses the platform order and nothing can be saved here.
          </p>
        </Card>
      ) : null}
      <TabNav base="/admin/ai-health" tabs={TABS} active={tab} label="AI health sections" />

      {tab === "features" ? (
        <Table caption="AI features">
          <thead>
            <tr>
              <th className={th}>Feature</th>
              <th className={th}>Used in</th>
              <th className={th}>Provider and model</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {AI_FEATURES.map((f) => {
              const route = o.routes[f.key] ?? null;
              const active = route?.enabled ? route : null;
              const fallbackOrder = AI_PROVIDERS.filter((p) => configured.has(p));
              const primary = active ? { provider: active.primaryProvider, model: active.primaryModel || defaults[active.primaryProvider] || "" } : fallbackOrder[0] ? { provider: fallbackOrder[0], model: defaults[fallbackOrder[0]] ?? "" } : null;
              const fallback = active?.fallbackProvider ? { provider: active.fallbackProvider, model: active.fallbackModel || defaults[active.fallbackProvider] || "" } : null;
              const ready = f.engine === "sarvam" ? configured.has("sarvam") : f.engine === "llm_sarvam" ? fallbackOrder.length > 0 || configured.has("sarvam") : fallbackOrder.length > 0;
              return (
                <tr key={f.key}>
                  <td className={td}>
                    <p className="font-medium">{f.label}</p>
                    <p className="max-w-[22rem] text-caption text-muted">{f.description}</p>
                    <p className="mt-1 font-mono text-caption text-muted">{f.key}{f.creditKind ? " · uses credits" : " · free"}</p>
                  </td>
                  <td className={td}>
                    <p className="text-small">{f.usedIn}</p>
                    <p className="font-mono text-caption text-muted">{f.source}</p>
                  </td>
                  <td className={td}>
                    {f.engine === "sarvam" ? (
                      <span className="text-small">Sarvam AI <span className="font-mono text-caption text-muted">sarvam-105b-conversations</span></span>
                    ) : primary ? (
                      <>
                        <RouteSummary provider={primary.provider} model={primary.model} />
                        {fallback ? <RouteSummary provider={fallback.provider} model={fallback.model} fallback /> : null}
                        {!active ? <span className="block text-caption text-muted">Platform order{fallbackOrder.length > 1 ? `, then ${fallbackOrder.slice(1).map((p) => PROVIDER_LABELS[p]).join(", ")}` : ""}</span> : null}
                        {f.engine === "llm_sarvam" ? <span className="block text-caption text-muted">Sarvam if these fail</span> : null}
                      </>
                    ) : (
                      <span className="text-small text-muted">{f.engine === "llm_sarvam" && configured.has("sarvam") ? "Sarvam AI only (no LLM key)" : "No provider key set"}</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={ready ? "success" : "error"}>{ready ? "ready" : "not configured"}</Badge>
                      {f.routable ? <Badge tone={active ? "accent" : "neutral"}>{active ? "custom route" : route ? "route off" : "default order"}</Badge> : <Badge tone="neutral">{ENGINE_LABELS[f.engine]}</Badge>}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap items-start gap-2">
                      {f.routable && o.available ? <EditRouteDialog feature={f} route={route} defaults={defaults} /> : null}
                      {f.routable && route ? <ResetRouteButton featureKey={f.key} /> : null}
                      {primary && f.engine !== "sarvam" ? <TestModelButton featureKey={f.key} provider={primary.provider} model={primary.model} label="Test primary" /> : null}
                      {fallback ? <TestModelButton featureKey={f.key} provider={fallback.provider} model={fallback.model} label="Test fallback" /> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Table caption="Calls, tokens and cost per model (last 30 days)">
          <thead>
            <tr>
              <th className={th}>Provider</th>
              <th className={th}>Model</th>
              <th className={th}>Calls</th>
              <th className={th}>Tokens</th>
              <th className={th}>₹ per 1M tokens</th>
              <th className={th}>Cost</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {o.models.length === 0 ? (
              <tr>
                <td className={td} colSpan={7}>
                  <span className="text-small text-muted">No models yet. Add a provider key in Admin → Social apps.</span>
                </td>
              </tr>
            ) : (
              o.models.map((m) => (
                <tr key={`${m.provider}:${m.model}`}>
                  <td className={td}>{PROVIDER_NAMES[m.provider] ?? m.provider}</td>
                  <td className={td}>
                    <span className="font-mono text-caption">{m.model || "(not logged)"}</span>
                    {m.inRoutes ? <span className="ml-2"><Badge tone="accent">in use</Badge></span> : null}
                  </td>
                  <td className={`${td} tabular-nums`}>{nf.format(m.calls)}</td>
                  <td className={`${td} tabular-nums`}>{nf.format(m.tokens)}</td>
                  <td className={td}>
                    <PriceCell minor={m.pricePerMillionMinor} />
                  </td>
                  <td className={`${td} tabular-nums`}>{m.pricePerMillionMinor == null ? "—" : formatMoney(m.costMinor)}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-start gap-2">
                      {o.available ? <ModelPriceDialog provider={m.provider} model={m.model} pricePerMillionMinor={m.pricePerMillionMinor} /> : null}
                      {isLlm(m.provider) && m.model ? <TestModelButton provider={m.provider} model={m.model} /> : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
