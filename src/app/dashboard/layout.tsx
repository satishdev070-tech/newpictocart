import type { Metadata } from "next";
import { Suspense } from "react";
import { platformIconMetadata } from "@/features/platform/server/public-config";
import Link from "next/link";
import { ChevronsUpDown, ExternalLink, Shield, UserCircle } from "lucide-react";
import { requireTenant } from "@/lib/tenant/membership";
import { DASHBOARD_NAV } from "@/components/dashboard/nav";
import { AppShell } from "@/components/app-shell/app-shell";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { AppearanceQuickToggle, AppearanceToggle } from "@/components/ui/appearance-toggle";
import { PanelLogo, PanelMark } from "@/components/app-shell/panel-logo";
import { switchTenantAction } from "@/features/tenants/actions";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { roleLabel } from "@/lib/permissions/labels";
import { cookies } from "next/headers";
import { navForSiteMode } from "@/features/stores/site-mode";
import { getStoreSiteMode } from "@/features/stores/site-mode-server";
import { getI18n } from "@/lib/i18n/server";
import { localizeNav } from "@/components/dashboard/nav-i18n";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { TourLauncher } from "@/features/dashboard-ui/tours/tour-launcher";
import { StoreAgentLauncher } from "@/features/seller-ai/components/store-agent-launcher";
import { SellerTopbarChrome, SellerTopbarChromeFallback, SellerTrialBanner } from "@/features/dashboard-ui/shell-chrome";
import { SidebarLink } from "@/components/app-shell/sidebar-link";
import { accountAccessFor } from "@/lib/auth/landing";
import { canSwitchPanels } from "@/lib/auth/role-routing";
import { SUPPORT_LOGIN_COOKIE, readSupportLogin } from "@/features/platform/server/store-admin";
import { endSupportLoginAction } from "@/features/platform/store-admin-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { default: "Dashboard", template: "%s · Dashboard" }, robots: { index: false, follow: false }, ...(await platformIconMetadata()) };
}

function Monogram({ name, className = "size-7" }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-lg bg-accent-soft text-caption font-bold text-accent ring-1 ring-inset ring-accent/20 ${className}`}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireTenant();
  const storeUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  // Shell-critical only — bell / alerts / trial / credits stream under Suspense so child routes paint earlier.
  const [cookieStore, siteMode, { locale, m, t }, access] = await Promise.all([
    cookies(),
    getStoreSiteMode(ctx.tenantId),
    getI18n(),
    accountAccessFor(ctx.user.id),
  ]);
  const showAdminSwitch = access ? canSwitchPanels(access) : false;
  const groups = localizeNav(
    navForSiteMode(
      DASHBOARD_NAV.map((g) => ({ ...g, items: g.items.filter((i) => ctx.permissions.has(i.permission)) })).filter((g) => g.items.length),
      siteMode,
    ),
    m.nav,
  );
  const displayName = ctx.user.displayName ?? ctx.user.email ?? "Account";

  const brand = <PanelLogo href="/dashboard" label="Pictocart seller dashboard" />;
  const brandMark = <PanelMark href="/dashboard" label="Pictocart seller dashboard" />;

  // Store identity (opens the live storefront) and sign-out, above the sidebar's Collapse control.
  const sidebarFooter = (
    <>
      <SidebarLink href="/dashboard/profile" icon={<UserCircle aria-hidden strokeWidth={1.75} />}>
        {t("account.myProfile")}
      </SidebarLink>
      {showAdminSwitch ? (
        <SidebarLink href="/admin" tone="admin" icon={<Shield aria-hidden strokeWidth={1.75} />}>
          {t("account.adminPanel")}
        </SidebarLink>
      ) : null}
      <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-secondary">
        <Monogram name={ctx.tenantName} className="size-8" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-semibold">{ctx.tenantName}</span>
          <span className="block truncate text-caption text-muted">{t("account.viewStorefront")}</span>
        </span>
        <ExternalLink aria-hidden className="size-4 shrink-0 text-subtle group-hover:text-accent" strokeWidth={1.75} />
      </a>
      <SignOutButton label={t("account.signOut")} />
    </>
  );

  const support = readSupportLogin(cookieStore.get(SUPPORT_LOGIN_COOKIE)?.value);
  const supporting = Boolean(support && support.userId === ctx.user.id);

  const topbarEnd = (
    <>
      <TourLauncher
        locale={locale}
        takeLabel={t("tour.take")}
        labels={{ next: t("tour.next"), back: t("tour.back"), done: t("tour.done"), close: t("tour.close"), stepOf: m.tour.stepOf }}
        autoStart={!supporting}
      />
      <AppearanceQuickToggle />
      <Suspense fallback={<SellerTopbarChromeFallback />}>
        <SellerTopbarChrome
          canCredits={ctx.permissions.has("marketing.read")}
          creditsLabel={t("account.aiCredits")}
          creditsWord={t("account.credits")}
        />
      </Suspense>
      <div data-tour="account">
      <Popover
        label={t("account.menu")}
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
            {roleLabel(ctx.role, ctx.customRoleName)} · {ctx.tenantName}
          </p>
        </div>
        {ctx.memberships.length > 1 ? (
          <div className="border-t border-border pt-1.5">
            <p className="px-2.5 pb-1 text-overline text-subtle">{t("account.switchStore")}</p>
            {ctx.memberships.map((m) => (
              <form key={m.tenantId} action={switchTenantAction}>
                <input type="hidden" name="tenantId" value={m.tenantId} />
                <PopoverItem>
                  <Monogram name={m.tenantName} className="size-5 text-[10px]" />
                  <span className="flex-1 truncate">{m.tenantName}</span>
                  {m.tenantId === ctx.tenantId ? <span className="text-caption text-accent">{t("account.current")}</span> : null}
                </PopoverItem>
              </form>
            ))}
          </div>
        ) : null}
        <div className="border-t border-border px-2.5 py-2">
          <p className="mb-1.5 text-overline text-subtle">{t("account.appearance")}</p>
          <AppearanceToggle className="w-full justify-between" />
        </div>
        <div className="border-t border-border px-2.5 py-2">
          <p className="mb-1.5 text-overline text-subtle">{t("account.language")}</p>
          <LanguageSwitcher current={locale} label={t("account.language")} className="w-full" />
        </div>
        <div className="border-t border-border pt-1.5">
          <PopoverItem href="/dashboard/profile">
            <UserCircle aria-hidden /> {t("account.myProfile")}
          </PopoverItem>
          {showAdminSwitch ? (
            <PopoverItem href="/admin">
              <Shield aria-hidden /> {t("account.adminPanel")}
            </PopoverItem>
          ) : null}
          <PopoverItem href={storeUrl} external>
            <ExternalLink aria-hidden /> {t("account.viewStorefront")}
          </PopoverItem>
          <SignOutButton variant="menu" label={t("account.signOut")} />
        </div>
      </Popover>
      </div>
    </>
  );

  // Platform super admin signed in as this member (Admin → Store → Log in as store).
  const supportBanner =
    support && supporting ? (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/15 px-5 py-2 text-small text-foreground">
        <span>
          <span className="font-semibold">Support sign-in:</span> you&apos;re acting as {ctx.user.email} in {ctx.tenantName} (started by {support.adminEmail || "a super admin"}). Every action is recorded.
        </span>
        <form action={endSupportLoginAction}>
          <button type="submit" className="rounded-md border border-warning px-3 py-1 text-caption font-medium hover:bg-warning/20">
            End support sign-in
          </button>
        </form>
      </div>
    ) : null;

  const suspendedBanner =
    ctx.tenantStatus === "suspended" ? (
      <div role="alert" className="border-b border-error/30 bg-error/10 px-5 py-2 text-small text-error">
        {t("banners.suspended")}{" "}
        <Link href="/dashboard/settings/plan" className="font-medium underline underline-offset-2">
          {t("banners.activatePlan")}
        </Link>{" "}
        {t("banners.suspendedTail")}
      </div>
    ) : null;

  const banner =
    supportBanner || suspendedBanner || ctx.tenantStatus === "trial" ? (
      <>
        {supportBanner}
        {suspendedBanner}
        {ctx.tenantStatus === "trial" ? (
          <Suspense fallback={null}>
            <SellerTrialBanner t={t} locale={locale} />
          </Suspense>
        ) : null}
      </>
    ) : null;

  const shellText = {
    mainNav: t("shell.mainNav"),
    navigation: t("shell.navigation"),
    openNav: t("shell.openNav"),
    closeNav: t("shell.closeNav"),
    expandSidebar: t("shell.expandSidebar"),
    collapseSidebar: t("shell.collapseSidebar"),
    searchPlaceholder: t("shell.searchPlaceholder"),
    search: t("shell.search"),
    searchPages: t("shell.searchPages"),
    jumpTo: t("shell.jumpTo"),
    breadcrumb: t("shell.breadcrumb"),
    segments: { new: t("shell.crumbNew"), edit: t("shell.crumbEdit"), import: t("shell.crumbImport"), export: t("shell.crumbExport"), support: t("shell.crumbSupport"), details: t("shell.crumbDetails") },
  };

  return (
    <AppShell groups={groups} homeHref="/dashboard" brand={brand} brandMark={brandMark} sidebarFooter={sidebarFooter} topbarEnd={topbarEnd} banner={banner} storageKey="paliya-seller-sidebar" lang={locale} text={shellText}>
      {children}
      {ctx.permissions.has("analytics.read") ? <StoreAgentLauncher text={m.ai.agent} /> : null}
    </AppShell>
  );
}
