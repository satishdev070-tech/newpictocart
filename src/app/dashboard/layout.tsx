import type { Metadata } from "next";
import { platformIconMetadata } from "@/features/platform/server/public-config";
import Link from "next/link";
import { ChevronsUpDown, ExternalLink, LogOut, Sparkles } from "lucide-react";
import { requireTenant } from "@/lib/tenant/membership";
import { DASHBOARD_NAV } from "@/components/dashboard/nav";
import { AppShell } from "@/components/app-shell/app-shell";
import { NotificationBell } from "@/features/notifications/inbox/components/notification-bell";
import { getBellData } from "@/features/notifications/inbox/server";
import { Popover, PopoverItem } from "@/components/app-shell/popover";
import { AppearanceQuickToggle, AppearanceToggle } from "@/components/ui/appearance-toggle";
import { PanelLogo, PanelMark } from "@/components/app-shell/panel-logo";
import { switchTenantAction } from "@/features/tenants/actions";
import { signOutAction } from "@/features/auth/actions";
import { getDashboardAlerts } from "@/features/dashboard-ui/alerts";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { roleLabel } from "@/lib/permissions/labels";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { navForSiteMode, parseSiteMode } from "@/features/stores/site-mode";
import { getAiCreditBalance } from "@/features/ai-credits/server";
import { getI18n } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";
import { localizeNav } from "@/components/dashboard/nav-i18n";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { TourLauncher } from "@/features/dashboard-ui/tours/tour-launcher";

/** Plan name and trial end of the active store (RLS: members read their tenant). Null on error. */
async function trialInfo(tenantId: string): Promise<{ plan: string | null; endsAt: string | null } | null> {
  const { data } = await (await createSupabaseServerClient()).from("tenants").select("trial_ends_at, plans(name)").eq("id", tenantId).maybeSingle();
  if (!data) return null;
  const plan = (data as { plans: { name: string } | { name: string }[] | null }).plans;
  return { plan: (Array.isArray(plan) ? plan[0]?.name : plan?.name) ?? null, endsAt: data.trial_ends_at };
}

/** "Free trial of the Scale plan · 9 days left (ends 20 Oct 2026)." Status stays "trial" until the platform activates the plan. */
function trialMessage(trial: { plan: string | null; endsAt: string | null } | null, t: T, locale: string): string {
  const plan = trial?.plan;
  if (!trial?.endsAt) return plan ? t("banners.trialOnPlan", { plan }) : t("banners.trial");
  const end = new Date(trial.endsAt);
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  const date = new Intl.DateTimeFormat(`${locale}-IN`, { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(end);
  if (days < 0) return plan ? t("banners.trialEndedOnPlan", { plan, date }) : t("banners.trialEnded", { date });
  const left = days === 0 ? t("banners.endsToday") : days === 1 ? t("banners.oneDayLeft") : t("banners.daysLeft", { days });
  return plan ? t("banners.trialLeftOnPlan", { plan, left, date }) : t("banners.trialLeft", { left, date });
}
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
  const { data: storeMode } = await (await createSupabaseServerClient()).from("stores").select("site_mode").eq("tenant_id", ctx.tenantId).maybeSingle();
  const { locale, m, t } = await getI18n();
  const navGroups = navForSiteMode(
    DASHBOARD_NAV.map((g) => ({ ...g, items: g.items.filter((i) => ctx.permissions.has(i.permission)) })).filter((g) => g.items.length),
    parseSiteMode(storeMode?.site_mode),
  );
  const groups = localizeNav(navGroups, m.nav);
  const storeUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  // Independent reads in parallel (the cookie store is needed only for the support banner).
  const [alerts, trial, cookieStore, bell, aiCreditBalance] = await Promise.all([
    getDashboardAlerts(ctx),
    // Free forever (active, no trial end) must not show a trial banner.
    ctx.tenantStatus === "trial" ? trialInfo(ctx.tenantId) : Promise.resolve(null),
    cookies(),
    getBellData({ userId: ctx.user.id, scope: "tenant", tenantId: ctx.tenantId }),
    ctx.permissions.has("marketing.read") ? getAiCreditBalance(ctx.tenantId) : Promise.resolve(null),
  ]);
  const showTrialBanner = ctx.tenantStatus === "trial" && Boolean(trial?.endsAt);
  const displayName = ctx.user.displayName ?? ctx.user.email ?? "Account";

  const brand = <PanelLogo href="/dashboard" label="Pictocart seller dashboard" />;
  const brandMark = <PanelMark href="/dashboard" label="Pictocart seller dashboard" />;

  // Store identity (opens the live storefront) and sign-out, above the sidebar's Collapse control.
  const sidebarFooter = (
    <>
      <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-secondary">
        <Monogram name={ctx.tenantName} className="size-8" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-semibold">{ctx.tenantName}</span>
          <span className="block truncate text-caption text-muted">{t("account.viewStorefront")}</span>
        </span>
        <ExternalLink aria-hidden className="size-4 shrink-0 text-subtle group-hover:text-accent" strokeWidth={1.75} />
      </a>
      <form action={signOutAction}>
        <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-small text-error transition-colors hover:bg-error/10">
          <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
          {t("account.signOut")}
        </button>
      </form>
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
      {aiCreditBalance !== null ? (
        <Link
          href="/dashboard/marketing/neural-pulse"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2.5 text-caption font-semibold text-accent transition-colors hover:bg-accent/15"
          title={t("account.aiCredits")}
        >
          <Sparkles aria-hidden className="size-3.5" />
          <span>{aiCreditBalance}</span>
          <span className="hidden sm:inline">{t("account.credits")}</span>
        </Link>
      ) : null}
      <NotificationBell scope="tenant" userId={ctx.user.id} initial={bell} attention={alerts} viewAllHref="/dashboard/notifications" />
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
          <PopoverItem href={storeUrl} external>
            <ExternalLink aria-hidden /> {t("account.viewStorefront")}
          </PopoverItem>
          <form action={signOutAction}>
            <PopoverItem>
              <LogOut aria-hidden /> {t("account.signOut")}
            </PopoverItem>
          </form>
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

  const statusBanner =
    ctx.tenantStatus === "suspended" ? (
      <div role="alert" className="border-b border-error/30 bg-error/10 px-5 py-2 text-small text-error">
        {t("banners.suspended")}{" "}
        <Link href="/dashboard/settings/plan" className="font-medium underline underline-offset-2">
          {t("banners.activatePlan")}
        </Link>{" "}
        {t("banners.suspendedTail")}
      </div>
    ) : showTrialBanner ? (
      <div className="border-b border-border bg-accent-soft px-5 py-2 text-small text-foreground">
        {trialMessage(trial, t, locale)}{" "}
        <Link href="/dashboard/settings/plan" className="font-medium underline underline-offset-2">
          {t("banners.choosePlan")}
        </Link>
      </div>
    ) : null;
  const banner = supportBanner || statusBanner ? (
    <>
      {supportBanner}
      {statusBanner}
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
    </AppShell>
  );
}
