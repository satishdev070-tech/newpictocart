import Link from "next/link";
import { BellOff, Settings2 } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/layout";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { GROUP_LABELS, NOTIFICATION_TYPES, groupsForScope, receivableTypes, type NotificationGroup } from "../catalog";
import { getMutedTypes, listNotifications, type InboxAudience } from "../server";
import { MarkAllReadButton, NotificationList, PreferencesForm } from "./notification-list";

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * /dashboard/notifications and /admin/notifications. Filters (?status=unread, ?group=orders) and
 * ?page= are plain links, so the page is server-rendered and shareable; ?tab=preferences shows
 * the per-type in-app toggles.
 */
export async function NotificationsPage({ audience, sp, basePath, can, description }: { audience: InboxAudience; sp: SearchParams; basePath: string; can: (permission: string) => boolean; description: string }) {
  const scope = audience.scope;
  const groups = groupsForScope(scope);
  const tab = sp.tab === "preferences" ? "preferences" : "feed";
  const status = sp.status === "unread" ? "unread" : "all";
  const group = typeof sp.group === "string" && (groups as string[]).includes(sp.group) ? (sp.group as NotificationGroup) : null;
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));

  const href = (p: { status?: string; group?: string | null; tab?: string }) => {
    const q = new URLSearchParams();
    const s = p.status ?? status;
    const g = p.group === undefined ? group : p.group;
    if (p.tab) q.set("tab", p.tab);
    else {
      if (s === "unread") q.set("status", "unread");
      if (g) q.set("group", g);
    }
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const header = (
    <PageHeader
      title="Notifications"
      description={description}
      actions={
        <Link href={tab === "preferences" ? basePath : href({ tab: "preferences" })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-small font-medium shadow-xs hover:bg-surface-secondary">
          <Settings2 aria-hidden className="size-4" />
          {tab === "preferences" ? "Back to notifications" : "Preferences"}
        </Link>
      }
    />
  );

  if (tab === "preferences") {
    const offered = receivableTypes(scope, can);
    const muted = await getMutedTypes(audience.userId);
    const byGroup = groups.map((g) => ({ label: GROUP_LABELS[g], types: offered.filter((t) => NOTIFICATION_TYPES[t].group === g) })).filter((g) => g.types.length);
    return (
      <div className="space-y-6">
        {header}
        <Card title="In-app notifications" description="Choose what shows up in your bell. This only affects you; teammates keep their own settings.">
          {offered.length ? <PreferencesForm scope={scope} offered={offered} muted={muted} groups={byGroup} /> : <p className="text-small text-muted">Your role doesn&apos;t receive any notification types yet.</p>}
        </Card>
      </div>
    );
  }

  const { items, total } = await listNotifications(audience, { status, group, page, pageSize: PAGE_SIZE });
  const chip = (active: boolean) => cn("inline-flex h-8 items-center rounded-full border px-3 text-small font-medium transition-colors", active ? "border-accent/30 bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-foreground");

  return (
    <div className="space-y-6">
      {header}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter notifications" className="flex flex-wrap gap-2">
          <Link href={href({ status: "all" })} className={chip(status === "all")} aria-current={status === "all" ? "page" : undefined}>
            All
          </Link>
          <Link href={href({ status: "unread" })} className={chip(status === "unread")} aria-current={status === "unread" ? "page" : undefined}>
            Unread
          </Link>
          <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
          <Link href={href({ group: null })} className={chip(!group)}>
            Every type
          </Link>
          {groups.map((g) => (
            <Link key={g} href={href({ group: g })} className={chip(group === g)} aria-current={group === g ? "page" : undefined}>
              {GROUP_LABELS[g]}
            </Link>
          ))}
        </nav>
        <MarkAllReadButton scope={scope} disabled={!items.some((i) => !i.readAt) && status !== "unread"} />
      </div>

      {items.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <NotificationList scope={scope} userId={audience.userId} items={items} />
        </div>
      ) : (
        <EmptyState
          icon={<BellOff aria-hidden />}
          title={status === "unread" ? "No unread notifications" : "No notifications yet"}
          description={status === "unread" || group ? "Try another filter." : scope === "tenant" ? "We'll let you know about new orders, payments, stock and more." : "Sign-ups, new stores and plan requests will show up here."}
        />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} params={{ status: status === "unread" ? "unread" : undefined, group: group ?? undefined }} />
    </div>
  );
}
