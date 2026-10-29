import type { Metadata } from "next";
import { Suspense } from "react";
import { ChevronsUpDown, Shield, Store, UserCircle } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { adminNavFor } from "@/features/platform/nav";
import { AppShell } from "@/components/app-shell/app-shell";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { AppearanceQuickToggle, AppearanceToggle } from "@/components/ui/appearance-toggle";
import { PanelLogo, PanelMark } from "@/components/app-shell/panel-logo";
import { PLATFORM_NAME } from "@/config/platform";
import { platformIconMetadata } from "@/features/platform/server/public-config";
import { SidebarLink } from "@/components/app-shell/sidebar-link";
import { accountAccessFor } from "@/lib/auth/landing";
import { canSwitchPanels } from "@/lib/auth/role-routing";
import { AdminSupportBanner, AdminTopbarChrome, AdminTopbarChromeFallback } from "@/features/platform/components/admin-shell-chrome";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false }, ...(await platformIconMetadata()) };
}

const ROLE_LABEL = { super_admin: "Super admin", support: "Support", finance: "Finance" } as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const ctx = await requirePlatform();
  const groups = adminNavFor(ctx.permissions);
  // Shell-critical only — overview / support sessions / bell stream under Suspense.
  const access = await accountAccessFor(ctx.user.id);
  const showSellerSwitch = access ? canSwitchPanels(access) : false;

  const label = `${PLATFORM_NAME} super admin`;
  const brand = <PanelLogo href="/admin" label={label} />;
  const brandMark = <PanelMark href="/admin" label={label} />;
  const shield = (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#f97316] to-[#dc2626] text-white shadow-xs">
      <Shield className="size-4" strokeWidth={2.25} />
    </span>
  );

  const sidebarFooter = (
    <>
      <SidebarLink href="/admin/profile" icon={<UserCircle aria-hidden strokeWidth={1.75} />}>
        My Profile
      </SidebarLink>
      {showSellerSwitch ? (
        <SidebarLink href="/dashboard" icon={<Store aria-hidden strokeWidth={1.75} />}>
          Seller Dashboard
        </SidebarLink>
      ) : null}
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
      <SignOutButton />
    </>
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
      <Suspense fallback={<AdminTopbarChromeFallback />}>
        <AdminTopbarChrome userId={ctx.user.id} canOverview={ctx.permissions.has("platform.tenants.read")} />
      </Suspense>
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
          <PopoverItem href="/admin/profile">
            <UserCircle aria-hidden /> My Profile
          </PopoverItem>
          {showSellerSwitch ? (
            <PopoverItem href="/dashboard">
              <Store aria-hidden /> Seller Dashboard
            </PopoverItem>
          ) : null}
          <SignOutButton variant="menu" />
        </div>
      </Popover>
    </>
  );

  const banner = ctx.permissions.has("platform.support.impersonate") ? (
    <Suspense fallback={null}>
      <AdminSupportBanner userId={ctx.user.id} />
    </Suspense>
  ) : null;

  return (
    <AppShell groups={groups} homeHref="/admin" brand={brand} brandMark={brandMark} sidebarFooter={sidebarFooter} topbarStart={topbarStart} topbarEnd={topbarEnd} banner={banner} storageKey="paliya-console-sidebar">
      {children}
    </AppShell>
  );
}
