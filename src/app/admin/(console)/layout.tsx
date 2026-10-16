import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronsUpDown, LogOut, Shield } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { adminNavFor } from "@/features/platform/nav";
import { getMyActiveSupportSessions, getPlatformOverview } from "@/features/platform/server/queries";
import { AppShell } from "@/components/app-shell/app-shell";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { AppearanceQuickToggle, AppearanceToggle } from "@/components/ui/appearance-toggle";
import { PanelLogo, PanelMark } from "@/components/app-shell/panel-logo";
import { signOutAction } from "@/features/auth/actions";
import { PLATFORM_NAME } from "@/config/platform";
import { platformIconMetadata } from "@/features/platform/server/public-config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false }, ...(await platformIconMetadata()) };
}

const ROLE_LABEL = { super_admin: "Super admin", support: "Support", finance: "Finance" } as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const ctx = await requirePlatform();
  const groups = adminNavFor(ctx.permissions);
  // getPlatformOverview is request-cached, so the overview page reuses this result.
  const [sessions, overview] = await Promise.all([
    ctx.permissions.has("platform.support.impersonate") ? getMyActiveSupportSessions(ctx.user.id) : Promise.resolve([]),
    ctx.permissions.has("platform.tenants.read") ? getPlatformOverview().catch(() => null) : Promise.resolve(null),
  ]);
  const alerts = overview
    ? [
        { key: "trials", label: "trials ending in 7 days", count: overview.trialsEnding7d, href: "/admin/tenants?status=trial" },
        { key: "domains", label: "custom domains awaiting verification", count: overview.customDomainsPending, href: "/admin/domains?status=pending" },
      ].filter((a) => a.count > 0)
    : [];
  const alertTotal = alerts.reduce((s, a) => s + a.count, 0);

  const label = `${PLATFORM_NAME} super admin`;
  const brand = <PanelLogo href="/admin" label={label} />;
  const brandMark = <PanelMark href="/admin" label={label} />;
  const shield = (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#f97316] to-[#dc2626] text-white shadow-xs">
      <Shield className="size-4" strokeWidth={2.25} />
    </span>
  );

  const sidebarFooter = (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      {shield}
      <span className="min-w-0">
        <span className="block truncate text-small font-semibold">Super Admin</span>
        <span className="flex items-center gap-1.5 text-caption text-muted">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Signed in as {ROLE_LABEL[ctx.role]}
        </span>
      </span>
    </div>
  );

  // Always-visible marker that this is the platform console, not a store dashboard.
  const topbarStart = (
    <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-error/10 px-2.5 py-1.5 text-small font-semibold text-error sm:inline-flex">
      <Shield aria-hidden className="size-4" strokeWidth={2} />
      Admin mode
    </span>
  );

  const topbarEnd = (
    <>
      <AppearanceQuickToggle />
      <Popover
        label={alertTotal ? `Notifications, ${alertTotal} need attention` : "Notifications"}
        trigger={
          <span className="relative grid size-5 place-items-center">
            <Bell aria-hidden className="size-[18px]" strokeWidth={1.75} />
            {alertTotal ? <span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-strong ring-2 ring-surface" /> : null}
          </span>
        }
      >
        <p className="px-2.5 pb-1 pt-1.5 text-overline text-subtle">Needs attention</p>
        {alerts.length ? (
          alerts.map((a) => (
            <PopoverItem key={a.key} href={a.href}>
              <span className="grid min-w-6 place-items-center rounded bg-accent-soft px-1 text-caption font-semibold text-accent">{a.count}</span>
              <span>{a.label}</span>
            </PopoverItem>
          ))
        ) : (
          <p className="px-2.5 py-3 text-small text-muted">Nothing needs attention.</p>
        )}
      </Popover>
      <Popover
        label="Account"
        trigger={
          <>
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent-soft text-caption font-bold text-accent ring-1 ring-inset ring-accent/20">
              {(ctx.user.email ?? "A").slice(0, 1).toUpperCase()}
            </span>
            <ChevronsUpDown aria-hidden className="hidden size-3.5 sm:block" />
          </>
        }
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-small font-medium">{ctx.user.displayName ?? ctx.user.email}</p>
          <p className="truncate text-caption text-muted">{ctx.user.email}</p>
          <p className="mt-1 text-caption text-muted">{ROLE_LABEL[ctx.role]}</p>
        </div>
        <div className="border-t border-border px-2.5 py-2">
          <p className="mb-1.5 text-overline text-subtle">Appearance</p>
          <AppearanceToggle className="w-full justify-between" />
        </div>
        <div className="border-t border-border pt-1.5">
          <form action={signOutAction}>
            <input type="hidden" name="to" value="admin" />
            <PopoverItem>
              <LogOut aria-hidden /> Sign out
            </PopoverItem>
          </form>
        </div>
      </Popover>
    </>
  );

  const banner = sessions.length ? (
    <div role="status" className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-small">
      Active support session{sessions.length > 1 ? "s" : ""}:{" "}
      {sessions.map((s, i) => (
        <span key={s.id}>
          {i ? ", " : ""}
          <Link href={`/admin/tenants/${s.tenantId}/support`} className="font-medium underline">
            {s.tenantName ?? "store"}
          </Link>
        </span>
      ))}
    </div>
  ) : null;

  return (
    <AppShell groups={groups} homeHref="/admin" brand={brand} brandMark={brandMark} sidebarFooter={sidebarFooter} topbarStart={topbarStart} topbarEnd={topbarEnd} banner={banner} storageKey="paliya-console-sidebar">
      {children}
    </AppShell>
  );
}
