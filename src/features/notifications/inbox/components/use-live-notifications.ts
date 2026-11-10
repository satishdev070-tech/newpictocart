"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const POLL_MS = 60_000;

/**
 * Calls `onChange` when this user's notifications change: Supabase Realtime (RLS-filtered
 * postgres_changes on the user's rows) plus a light polling fallback (every 60 s while the tab is
 * visible and realtime is not connected, and on returning to the tab). Each poll is a server action that
 * re-runs auth and the notification queries, so it is skipped while realtime delivers changes. `onChange` is debounced so a burst of rows refreshes once.
 * Pass `userId: null` to turn it off.
 */
export function useLiveNotifications(userId: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 300);
    };

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null = null;
    let live = false;
    try {
      const supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel(`notifications:${userId}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, fire)
        .subscribe((status) => {
          live = status === "SUBSCRIBED";
        });
    } catch {
      // No public env / realtime unavailable: polling below still keeps the bell fresh.
    }

    const poll = setInterval(() => {
      if (!live && document.visibilityState === "visible") cb.current();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void getSupabaseBrowserClient().removeChannel(channel);
    };
  }, [userId]);
}
