"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Compass, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/layout";
import { useToast } from "@/components/ui/toast";
import { generateBusinessCoachAction, type BusinessCoachActionData } from "../actions";
import { BUSINESS_COACH_FALLBACK_CREDITS, type BusinessCoachTip } from "../schemas";

const PRIORITY_TONE = { high: "warning", medium: "accent", low: "neutral" } as const;

function errText(e: { message: string; fieldErrors?: Record<string, string[]> }) {
  return e.fieldErrors?._form?.[0] ?? Object.values(e.fieldErrors ?? {})[0]?.[0] ?? e.message;
}

function TipsList({ tips }: { tips: BusinessCoachTip[] }) {
  return (
    <ul className="space-y-3">
      {tips.map((t, i) => (
        <li key={`${t.title}-${i}`} className="space-y-1 border-t border-border pt-3 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{t.title}</p>
            <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
          </div>
          <p className="text-small text-muted">{t.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function BusinessCoachCard({
  creditCost,
  canGenerate,
  balance,
}: {
  creditCost: number | null;
  canGenerate: boolean;
  balance: number | null;
}) {
  const cost = creditCost ?? BUSINESS_COACH_FALLBACK_CREDITS;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<BusinessCoachActionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const run = () =>
    start(async () => {
      setError(null);
      const r = await generateBusinessCoachAction({ focus: "auto" });
      if (r.ok) {
        setResult(r.data);
        show({ tone: "success", message: "Fresh coaching tips ready." });
      } else {
        const text = errText(r.error);
        setError(text);
        show({ tone: "error", message: text });
      }
    });

  return (
    <Card
      title="Business coach"
      description={
        <>
          Practical tips from your store&apos;s products and recent sales.
          {canGenerate ? (
            <span className="mt-1 block tabular-nums">
              {cost} credit{cost === 1 ? "" : "s"} per refresh
              {balance !== null ? ` · ${balance} available` : null}
            </span>
          ) : null}
        </>
      }
      actions={
        canGenerate ? (
          <Button variant="secondary" size="sm" pending={pending} onClick={run} aria-label={result ? "Refresh coaching tips" : "Generate coaching tips"}>
            {result ? <RefreshCw aria-hidden /> : <Compass aria-hidden />}
            {result ? "Refresh" : "Get tips"}
          </Button>
        ) : null
      }
    >
      {!canGenerate ? (
        <p className="text-sm text-muted">Ask a store admin for marketing access to generate coaching tips.</p>
      ) : result ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{result.headline}</p>
            <p className="mt-1 text-small text-muted">{result.focus}</p>
          </div>
          <TipsList tips={result.tips} />
          <p className="text-caption text-muted">
            Written by {result.provider}
            {result.model ? ` (${result.model})` : ""}. Check against your own numbers before acting.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Get 3–5 next steps tailored to this store&apos;s catalogue, orders and setup gaps.</p>
          <Button variant="secondary" size="sm" pending={pending} onClick={run}>
            <Compass aria-hidden /> Get tips · {cost} credit{cost === 1 ? "" : "s"}
          </Button>
          {balance === 0 ? (
            <p className="text-caption text-muted">
              No credits left.{" "}
              <Link href="/dashboard/marketing/neural-pulse" className="font-medium text-accent hover:underline">
                Buy AI credits
              </Link>
            </p>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
