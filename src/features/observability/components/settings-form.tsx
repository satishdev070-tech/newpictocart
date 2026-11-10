"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveObservabilitySettingAction } from "@/features/observability/actions";

export function SettingsForm({ settingKey, defaultValue }: { settingKey: string; defaultValue: string }) {
  const [state, action, pending] = useActionState(saveObservabilitySettingAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="key" value={settingKey} />
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-caption text-muted">
        <span className="font-mono text-foreground">{settingKey}</span>
        <input
          name="value"
          defaultValue={defaultValue}
          className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-small text-foreground"
        />
      </label>
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        Save
      </Button>
      {state?.ok ? <span className="text-caption text-success">Saved</span> : null}
      {state && !state.ok ? <span className="text-caption text-error">{state.error}</span> : null}
    </form>
  );
}
