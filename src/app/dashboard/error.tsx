"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
    console.error(JSON.stringify({ level: "error", msg: "dashboard.route_error", digest: digest || null, message, time: new Date().toISOString() }));
  }, [error]);

  return (
    <ErrorState
      title="This page couldn't load"
      description={error.digest ? `Reference: ${error.digest}` : "Please try again."}
      action={
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  );
}
