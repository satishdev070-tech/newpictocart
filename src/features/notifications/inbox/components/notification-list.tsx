"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import type { NotificationItem, NotificationScope, NotificationType } from "../catalog";
import { NOTIFICATION_TYPES } from "../catalog";
import { markAllReadAction, markReadAction, markUnreadAction, savePreferencesAction } from "../actions";
import { NotificationEntry } from "./notification-bell";
import { useLiveNotifications } from "./use-live-notifications";

/** Full-page feed: optimistic mark-as-read on open, "mark unread" per row, live refresh. */
export function NotificationList({ scope, userId, items, live = true }: { scope: NotificationScope; userId: string; items: NotificationItem[]; live?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [now, setNow] = useState(() => Date.now());
  // New server data (router.refresh after a live event) replaces the optimistic rows.
  const [source, setSource] = useState(items);
  if (source !== items) {
    setSource(items);
    setRows(items);
  }
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveNotifications(live ? userId : null, refresh);

  const open = (n: NotificationItem) => {
    if (n.readAt) return;
    setRows((r) => r.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
    void markReadAction({ scope, ids: [n.id] });
  };
  const unread = (n: NotificationItem) => {
    setRows((r) => r.map((i) => (i.id === n.id ? { ...i, readAt: null } : i)));
    void markUnreadAction({ scope, id: n.id });
  };

  return (
    <ul className="divide-y divide-border">
      {rows.map((n) => (
        <li key={n.id} className="group relative">
          <NotificationEntry n={n} now={now} onOpen={() => open(n)} />
          {n.readAt ? (
            <button
              type="button"
              onClick={() => unread(n)}
              className="absolute right-3 top-2.5 hidden items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-caption text-muted hover:text-foreground focus-visible:inline-flex group-hover:inline-flex"
            >
              <MailOpen aria-hidden className="size-3.5" /> Mark unread
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MarkAllReadButton({ scope, disabled }: { scope: NotificationScope; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      pending={pending}
      disabled={disabled}
      onClick={() =>
        start(async () => {
          await markAllReadAction({ scope });
          router.refresh();
        })
      }
    >
      <CheckCheck aria-hidden className="size-4" /> Mark all as read
    </Button>
  );
}

/** Per-type in-app toggles. Unchecked types are muted (the bell skips them for this user). */
export function PreferencesForm({ scope, offered, muted, groups }: { scope: NotificationScope; offered: NotificationType[]; muted: string[]; groups: { label: string; types: NotificationType[] }[] }) {
  const [state, action] = useActionState(savePreferencesAction, null);
  const mutedSet = new Set(muted);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="scope" value={scope} />
      {offered.map((t) => (
        <input key={t} type="hidden" name="offered[]" value={t} />
      ))}
      {groups.map((g) => (
        <fieldset key={g.label}>
          <legend className="mb-2 text-overline text-subtle">{g.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.types.map((t) => (
              <label key={t} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-small hover:border-accent/40 has-[:checked]:bg-accent-soft/40">
                <span>{NOTIFICATION_TYPES[t].label}</span>
                <input type="checkbox" name="enabled[]" value={t} defaultChecked={!mutedSet.has(t)} className="size-4 accent-[var(--color-accent)]" />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <SubmitButton>Save preferences</SubmitButton>
        <FormMessage state={state} success="Preferences saved." />
      </div>
    </form>
  );
}
