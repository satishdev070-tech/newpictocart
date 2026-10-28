"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Popover } from "@/components/app-shell/popover";
import { cn } from "@/lib/cn";
import { relativeTime, safeLink, type NotificationItem, type NotificationScope } from "../catalog";
import { markAllReadAction, markReadAction, refreshBellAction } from "../actions";
import { playNotificationTone, readSoundPrefs, unlockNotificationAudio } from "../notification-sound";
import { shouldPlayNotificationSound } from "../sound-prefs";
import { NotificationIcon } from "./notification-icon";
import { useLiveNotifications } from "./use-live-notifications";

export type AttentionItem = { key: string; label: string; count: number; href: string };

type Props = {
  scope: NotificationScope;
  userId: string;
  initial: { unread: number; items: NotificationItem[] };
  /** Computed "needs attention" counters (orders to fulfil, pending domains...), shown above the feed. */
  attention?: AttentionItem[];
  viewAllHref: string;
};

/** Re-renders every minute so "5 min ago" stays true while the panel is open. */
function useMinuteTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function NotificationBell({ scope, userId, initial, attention = [], viewAllHref }: Props) {
  const [data, setData] = useState(initial);
  const dataRef = useRef(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const now = useMinuteTick();

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    unlockNotificationAudio();
  }, []);

  const refresh = useCallback(() => {
    void refreshBellAction(scope).then((r) => {
      if (!r.ok) return;
      const prev = dataRef.current;
      const next = r.data;
      const tabVisible = typeof document === "undefined" || document.visibilityState === "visible";
      if (
        shouldPlayNotificationSound({
          prefs: readSoundPrefs(),
          prevUnread: prev.unread,
          nextUnread: next.unread,
          prevItemIds: new Set(prev.items.map((i) => i.id)),
          nextItems: next.items,
          tabVisible,
        })
      ) {
        void playNotificationTone();
      }
      setData(next);
    });
  }, [scope]);
  useLiveNotifications(userId, refresh);

  const markOne = (n: NotificationItem) => {
    if (n.readAt) return;
    setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)) }));
    void markReadAction({ scope, ids: [n.id] });
  };
  const markAll = () => {
    const at = new Date().toISOString();
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, readAt: i.readAt ?? at })) }));
    startTransition(async () => {
      await markAllReadAction({ scope });
      router.refresh();
    });
  };

  const attentionTotal = attention.reduce((s, a) => s + a.count, 0);
  const unread = data.unread;
  const badge = unread > 99 ? "99+" : String(unread);
  const label = [unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications", attentionTotal ? `${attentionTotal} need attention` : ""].filter(Boolean).join(", ");

  return (
    <Popover
      label={label}
      className="w-[min(24rem,calc(100vw-5rem))]! p-0!"
      trigger={
        <span className="relative grid size-5 place-items-center">
          <Bell aria-hidden className="size-[18px]" strokeWidth={1.75} />
          {unread ? (
            <span aria-hidden className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface tabular-nums">
              {badge}
            </span>
          ) : attentionTotal ? (
            <span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-strong ring-2 ring-surface" />
          ) : null}
        </span>
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-small font-semibold">
          Notifications
          {unread ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent tabular-nums">{badge} new</span> : null}
        </p>
        {unread ? (
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-accent hover:bg-accent-soft">
            <CheckCheck aria-hidden className="size-3.5" />
            Mark all as read
          </button>
        ) : null}
      </div>

      {attention.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
          {attention.map((a) => (
            <Link key={a.key} href={a.href} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-caption hover:border-accent/40 hover:bg-accent-soft">
              <span className="font-semibold text-accent tabular-nums">{a.count}</span>
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}

      {data.items.length ? (
        <ul className="max-h-[min(26rem,65vh)] overflow-y-auto py-1">
          {data.items.map((n) => (
            <li key={n.id}>
              <NotificationEntry n={n} now={now} onOpen={() => markOne(n)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center">
          <span aria-hidden className="mx-auto mb-2 grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <Bell className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-small font-medium">You&apos;re all caught up</p>
          <p className="mt-0.5 text-caption text-muted">New orders, payments and alerts will show up here.</p>
        </div>
      )}

      <div className="border-t border-border p-1.5">
        <Link href={viewAllHref} className="block rounded-lg px-3 py-2 text-center text-small font-medium text-accent hover:bg-accent-soft">
          View all notifications
        </Link>
      </div>
    </Popover>
  );
}

/** One row: icon, title, body, relative time, unread dot. Opening it marks it read. */
export function NotificationEntry({ n, now, onOpen, compact }: { n: NotificationItem; now: number; onOpen: () => void; compact?: boolean }) {
  const href = safeLink(n.link);
  const inner = (
    <>
      <NotificationIcon type={n.type} className={compact ? "size-8" : undefined} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-small leading-snug", n.readAt ? "text-foreground/80" : "font-semibold text-foreground")}>{n.title}</span>
        {n.body ? <span className="mt-0.5 line-clamp-2 block text-caption text-muted">{n.body}</span> : null}
        <time dateTime={n.createdAt} suppressHydrationWarning className="mt-1 block text-caption text-subtle">
          {relativeTime(n.createdAt, now)}
        </time>
      </span>
      {n.readAt ? null : <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-strong" />}
    </>
  );
  const cls = cn("flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-secondary", n.readAt ? "" : "bg-accent-soft/40");
  return href ? (
    <Link href={href} onClick={onOpen} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>
      {inner}
    </button>
  );
}
