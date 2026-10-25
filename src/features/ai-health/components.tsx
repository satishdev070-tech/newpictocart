"use client";

import { useActionState } from "react";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/layout";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form";
import { ActionDialog, InlineAction } from "@/features/settings/ui/action-controls";
import { AI_PROVIDERS, PROVIDER_LABELS, type AiProvider } from "@/features/neural-pulse/schemas";
import type { AiFeature, FeatureRoute } from "./registry";
import { resetFeatureRouteAction, saveFeatureRouteAction, saveModelPriceAction, testModelAction } from "./actions";

const providerOptions = AI_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }));

/** Edit dialog for one feature's primary + fallback route. */
export function EditRouteDialog({ feature, route, defaults }: { feature: AiFeature; route: FeatureRoute | null; defaults: Record<string, string> }) {
  return (
    <ActionDialog
      action={saveFeatureRouteAction}
      fields={{ featureKey: feature.key }}
      title={`Route for ${feature.label}`}
      description="Calls go to the primary first, then the fallback. Only providers with an API key in Admin → Social apps are used. Leave a model blank to use the provider's default."
      triggerLabel={route ? "Edit" : "Set route"}
      confirmLabel="Save route"
      success="Route saved."
    >
      {(e) => (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Primary provider" name="primaryProvider" options={providerOptions} defaultValue={route?.primaryProvider ?? "gemini"} errors={e.primaryProvider} />
            <TextField label="Primary model" name="primaryModel" optional defaultValue={route?.primaryModel ?? ""} placeholder={defaults[route?.primaryProvider ?? "gemini"]} maxLength={100} errors={e.primaryModel} />
            <SelectField label="Fallback provider" name="fallbackProvider" options={[{ value: "none", label: "None" }, ...providerOptions]} defaultValue={route?.fallbackProvider ?? "none"} errors={e.fallbackProvider} />
            <TextField label="Fallback model" name="fallbackModel" optional defaultValue={route?.fallbackModel ?? ""} maxLength={100} errors={e.fallbackModel} />
          </div>
          <CheckboxField label="Use this route" name="enabled" defaultChecked={route?.enabled ?? true} hint="When off, the feature uses the platform order (Gemini, Groq, Anthropic)." />
        </div>
      )}
    </ActionDialog>
  );
}

export function ResetRouteButton({ featureKey }: { featureKey: string }) {
  return <InlineAction action={resetFeatureRouteAction} fields={{ featureKey }} label="Reset" success="Route removed." />;
}

/** One-provider health check: shows ok / latency / reason inline. */
export function TestModelButton({ featureKey, provider, model, label = "Test" }: { featureKey?: string; provider: AiProvider; model: string; label?: string }) {
  const [state, action] = useActionState(testModelAction, null);
  const r = state?.ok ? state.data : null;
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="model" value={model} />
      {featureKey ? <input type="hidden" name="featureKey" value={featureKey} /> : null}
      <SubmitButton variant="secondary" size="sm">
        {label}
      </SubmitButton>
      <span role="status" aria-live="polite" className="text-xs">
        {r ? r.ok ? <span className="text-success">OK · {r.latencyMs} ms</span> : <span className="text-error">Failed{r.latencyMs ? ` · ${r.latencyMs} ms` : ""}: {r.error}</span> : state && !state.ok ? <span className="text-error">{state.error.fieldErrors?._form?.[0] ?? state.error.message}</span> : null}
      </span>
    </form>
  );
}

export function ModelPriceDialog({ provider, model, pricePerMillionMinor }: { provider: string; model: string; pricePerMillionMinor: number | null }) {
  return (
    <ActionDialog
      action={saveModelPriceAction}
      fields={{ provider, model }}
      title={`Price for ${model || "(unknown model)"}`}
      description="Blended price per one million tokens (input and output together), used for AI cost on this page and in Revenue."
      triggerLabel={pricePerMillionMinor == null ? "Set price" : "Edit"}
      confirmLabel="Save price"
      success="Price saved."
      disabled={!model}
    >
      {(e) => <TextField label="₹ per 1M tokens" name="pricePerMillionMinor" inputMode="decimal" required defaultValue={pricePerMillionMinor == null ? "" : (pricePerMillionMinor / 100).toFixed(2)} errors={e.pricePerMillionMinor} />}
    </ActionDialog>
  );
}

export function RouteSummary({ provider, model, fallback }: { provider: AiProvider; model: string; fallback?: boolean }) {
  return (
    <span className="block">
      {fallback ? <span className="text-muted">then </span> : null}
      <span className="font-medium">{PROVIDER_LABELS[provider]}</span> <span className="font-mono text-caption text-muted">{model}</span>
    </span>
  );
}

export function PriceCell({ minor }: { minor: number | null }) {
  return minor == null ? <Badge tone="warning">not set</Badge> : <span className="tabular-nums">{formatMoney(minor)}</span>;
}
