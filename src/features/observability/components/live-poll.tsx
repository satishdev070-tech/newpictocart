"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Client island: refresh the RSC tree every `intervalMs` while visible; pause toggles. */
export function LivePoll({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastRefresh(Date.now());
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, paused]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
      <Button type="button" size="sm" variant={paused ? "accent" : "secondary"} onClick={() => setPaused((p) => !p)}>
        {paused ? "Resume live" : "Pause live"}
      </Button>
      <span aria-live="polite">
        {paused
          ? "Live updates paused"
          : lastRefresh
            ? `Refreshing every ${Math.round(intervalMs / 1000)}s · last ${new Date(lastRefresh).toLocaleTimeString("en-IN")}`
            : `Live · every ${Math.round(intervalMs / 1000)}s`}
      </span>
    </div>
  );
}
