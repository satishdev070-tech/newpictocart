"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { upsertAlertRuleAction } from "@/features/observability/actions";

const ctl = "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground";

export function CreateAlertRuleForm() {
  const [state, action, pending] = useActionState(upsertAlertRuleAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-caption text-muted">
        Name
        <input name="name" required maxLength={120} className={ctl} placeholder="Login p95" />
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Type
        <select name="ruleType" className={ctl} defaultValue="p95">
          <option value="p95">p95</option>
          <option value="error_rate">error_rate</option>
          <option value="p95_or_error_rate">p95_or_error_rate</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Severity
        <select name="severity" className={ctl} defaultValue="warning">
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Threshold ms (p95)
        <input name="thresholdMs" type="number" min={1} className={ctl} placeholder="800" />
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Threshold rate (0–1)
        <input name="thresholdRate" type="number" min={0} max={1} step={0.01} className={ctl} placeholder="0.05" />
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Route template (optional)
        <input name="routeTemplate" className={ctl} placeholder="/login" />
      </label>
      <label className="flex flex-col gap-1 text-caption text-muted">
        Cooldown minutes
        <input name="cooldownMinutes" type="number" min={0} defaultValue={30} className={ctl} />
      </label>
      <label className="flex items-center gap-2 text-small text-foreground sm:col-span-2">
        <input type="checkbox" name="enabled" value="true" defaultChecked />
        Enabled
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" pending={pending}>
          Create rule
        </Button>
        {state?.ok ? <span className="text-caption text-success">Saved</span> : null}
        {state && !state.ok ? <span className="text-caption text-error">{state.error.message}</span> : null}
      </div>
    </form>
  );
}
