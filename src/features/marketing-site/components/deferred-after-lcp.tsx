"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts children after the browser is idle (or ~1.5s), so the LCP image can win the network
 * without competing with secondary hero chrome (e.g. the marketing phone frame).
 */
export function DeferredAfterLcp({ children, fallback = null, timeoutMs = 1500 }: { children: ReactNode; fallback?: ReactNode; timeoutMs?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(go, { timeout: timeoutMs });
    } else {
      timeoutId = setTimeout(go, timeoutMs);
    }
    return () => {
      if (idleId !== undefined && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutMs]);
  return ready ? children : fallback;
}
