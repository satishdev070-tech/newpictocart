import Link from "next/link";
import { ChevronsUpDown, ExternalLink, Inbox, UserCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { PanelLogo, PanelMark } from "@/components/app-shell/panel-logo";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { SidebarLink } from "@/components/app-shell/sidebar-link";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { AppearanceQuickToggle } from "@/components/ui/appearance-toggle";
import { switchTenantAction } from "@/features/tenants/actions";
import { informativeNavFor } from "@/features/informative/panel/nav";
import { InformativeAssistant } from "@/features/informative/ai/assistant-panel";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { countNewEnquiries } from "@/features/informative/server/repo";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { roleLabel } from "@/lib/permissions/labels";

/**
 * Informative seller panel (InformativeRouteGuard + shell). Reuses the shared AppShell (header,
 * profile menu, styling) with the Informative sidebar; Online Store accounts never reach it.
 */
export default async function InformativePanelLayout({ children }: LayoutProps<"/informative">) {
  const ctx = await requireInformativeTenant();
  const siteUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  const displayName = ctx.user.displayName ?? ctx.user.email ?? "Account";
  // In-app badge for new leads (soft-fails: the panel must render even if the count can't load).
  const newLeads = ctx.permissions.has("customers.read") ? await countNewEnquiries(ctx).catch(() => 0) : 0;
  const brand = <PanelLogo href="/informative/dashboard" label="Pictocart website dashboard" />;
  const brandMark = <PanelMark href="/informative/dashboard" label="Pictocart website dashboard" />;

  const sidebarFooter = (
    <>
      <SidebarLink href="/informative/profile" icon={<UserCircle aria-hidden strokeWidth={1.75} />}>
        My profile
      </SidebarLink>
      <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-secondary">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-caption font-bold text-accent ring-1 ring-inset ring-accent/20">
          {ctx.tenantName.trim().slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-semibold">{ctx.tenantName}</span>
          <span className="block truncate text-caption text-muted">View website</span>
        </span>
        <ExternalLink aria-hidden className="size-4 shrink-0 text-subtle group-hover:text-accent" strokeWidth={1.75} />
      </a>
      <SignOutButton label="Sign out" />
    </>
  );

  const topbarEnd = (
    <>
      {ctx.permissions.has("customers.read") ? (
        <Link href="/informative/enquiries?status=NEW" className="relative grid size-9 place-items-center rounded-lg hover:bg-surface-secondary" aria-label={newLeads ? `${newLeads} new enquiries` : "Enquiries"}>
          <Inbox aria-hidden className="size-5" strokeWidth={1.75} />
          {newLeads ? (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
              {newLeads > 99 ? "99+" : newLeads}
            </span>
          ) : null}
        </Link>
      ) : null}
      <AppearanceQuickToggle />
      <Popover
        label="Account menu"
        trigger={
          <>
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent-soft text-caption font-bold text-accent ring-1 ring-inset ring-accent/20">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <ChevronsUpDown aria-hidden className="hidden size-3.5 sm:block" />
          </>
        }
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-small font-medium">{displayName}</p>
          <p className="truncate text-caption text-muted">{ctx.user.email}</p>
          <p className="mt-1 text-caption text-muted">
            {roleLabel(ctx.role, null)} · {ctx.tenantName}
          </p>
        </div>
        {ctx.memberships.length > 1 ? (
          <div className="border-t border-border pt-1.5">
            <p className="px-2.5 pb-1 text-overline text-subtle">Switch site or store</p>
            {ctx.memberships.map((m) => (
              <form key={m.tenantId} action={switchTenantAction}>
                <input type="hidden" name="tenantId" value={m.tenantId} />
                <PopoverItem>
                  <span className="flex-1 truncate">{m.tenantName}</span>
                  {m.tenantId === ctx.tenantId ? <span className="text-caption text-accent">Current</span> : null}
                </PopoverItem>
              </form>
            ))}
          </div>
        ) : null}
        <div className="border-t border-border pt-1.5">
          <PopoverItem href="/informative/profile">
            <UserCircle aria-hidden /> My profile
          </PopoverItem>
          <PopoverItem href={siteUrl} external>
            <ExternalLink aria-hidden /> View website
          </PopoverItem>
          <SignOutButton variant="menu" label="Sign out" />
        </div>
      </Popover>
    </>
  );

  const banner =
    ctx.tenantStatus === "suspended" ? (
      <div role="alert" className="border-b border-error/30 bg-error/10 px-5 py-2 text-small text-error">
        This website is suspended. <Link href="/informative/settings" className="font-medium underline underline-offset-2">Contact support</Link> to restore it.
      </div>
    ) : null;

  return (
    <AppShell groups={informativeNavFor(ctx.permissions)} homeHref="/informative/dashboard" brand={brand} brandMark={brandMark} sidebarFooter={sidebarFooter} topbarEnd={topbarEnd} banner={banner} storageKey="paliya-informative-sidebar">
      {children}
      <InformativeAssistant canWrite={ctx.permissions.has("content.write") && ctx.permissions.has("settings.write")} />
    </AppShell>
  );
}
