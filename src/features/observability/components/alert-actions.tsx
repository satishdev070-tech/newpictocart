"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acknowledgeIncidentAction, toggleAlertRuleAction } from "@/features/observability/actions";

export function ToggleAlertRuleButton({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(toggleAlertRuleAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        {enabled ? "Disable" : "Enable"}
      </Button>
      {state && !state.ok ? <span className="text-caption text-error">{state.error.message}</span> : null}
    </form>
  );
}

export function AcknowledgeIncidentButton({ incidentId }: { incidentId: string }) {
  const [state, action, pending] = useActionState(acknowledgeIncidentAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        Acknowledge
      </Button>
      {state && !state.ok ? <span className="text-caption text-error">{state.error.message}</span> : null}
    </form>
  );
}
