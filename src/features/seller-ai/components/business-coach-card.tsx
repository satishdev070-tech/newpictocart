"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { refreshBusinessCoachAction } from "@/features/seller-ai/actions";
import type { BusinessCoachResult } from "@/features/seller-ai/schemas";

const priorityTone = { high: "text-error", medium: "text-warning", low: "text-muted" } as const;

export function BusinessCoachCard() {
  const [result, setResult] = useState<BusinessCoachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    start(async () => {
      const r = await refreshBusinessCoachAction();
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        return;
      }
      setResult(r.data);
    });
  };

  return (
    <Card
      title="AI Business Coach"
      description="Tips from your store metrics and setup checklist. Uses AI credits."
      actions={
        <Button type="button" size="sm" variant="secondary" pending={pending} onClick={run}>
          {pending ? "Thinking…" : result ? "Refresh" : "Get tips"}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {!result && !error ? <p className="text-sm text-muted">Ask for a short coaching pass whenever you want a next step.</p> : null}
      {result ? (
        <div className="space-y-3">
          <div>
            <p className="font-medium">{result.headline}</p>
            {result.focus ? <p className="mt-1 text-sm text-muted">{result.focus}</p> : null}
          </div>
          <ul className="space-y-2.5">
            {result.tips.map((t, i) => (
              <li key={`${t.title}-${i}`} className="text-sm">
                <p className="font-medium">
                  <span className={`mr-2 text-caption uppercase ${priorityTone[t.priority]}`}>{t.priority}</span>
                  {t.title}
                </p>
                <p className="mt-0.5 text-muted">{t.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
