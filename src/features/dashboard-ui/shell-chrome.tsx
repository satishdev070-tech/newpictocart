import Link from "next/link";
import { Sparkles } from "lucide-react";
import { NotificationBell } from "@/features/notifications/inbox/components/notification-bell";
import { getBellData } from "@/features/notifications/inbox/server";
import { getDashboardAlerts } from "@/features/dashboard-ui/alerts";
import { getAiCreditBalance } from "@/features/ai-credits/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/membership";
import { Skeleton } from "@/components/ui/states";
import type { T } from "@/lib/i18n/translate";

/** Compact placeholders while bell / credits stream in. */
export function SellerTopbarChromeFallback() {
  return (
    <>
      <Skeleton className="hidden h-8 w-20 rounded-full sm:block" />
      <Skeleton className="size-8 rounded-lg" />
    </>
  );
}

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

/**
 * AI credits + notification bell (alerts + inbox). Streamed under Suspense so the seller shell
 * and child routes are not blocked on these reads.
 */
export async function SellerTopbarChrome({
  canCredits,
  creditsLabel,
  creditsWord,
}: {
  canCredits: boolean;
  creditsLabel: string;
  creditsWord: string;
}) {
  const ctx = await requireTenant();
  const [alerts, bell, aiCreditBalance] = await Promise.all([
    getDashboardAlerts(ctx),
    getBellData({ userId: ctx.user.id, scope: "tenant", tenantId: ctx.tenantId }),
    canCredits ? getAiCreditBalance(ctx.tenantId) : Promise.resolve(null),
  ]);

  return (
    <>
      {aiCreditBalance !== null ? (
        <Link
          href="/dashboard/marketing/neural-pulse"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-2.5 text-caption font-semibold text-accent transition-colors hover:bg-accent/15"
          title={creditsLabel}
        >
          <Sparkles aria-hidden className="size-3.5" />
          <span>{aiCreditBalance}</span>
          <span className="hidden sm:inline">{creditsWord}</span>
        </Link>
      ) : null}
      <NotificationBell scope="tenant" userId={ctx.user.id} initial={bell} attention={alerts} viewAllHref="/dashboard/notifications" />
    </>
  );
}

/**
 * Trial status strip. Only mounted when tenantStatus === "trial"; returns null when there is no
 * trial end date (free-forever / not yet dated).
 */
export async function SellerTrialBanner({ t, locale }: { t: T; locale: string }) {
  const ctx = await requireTenant();
  if (ctx.tenantStatus !== "trial") return null;
  const trial = await trialInfo(ctx.tenantId);
  if (!trial?.endsAt) return null;
  return (
    <div className="border-b border-border bg-accent-soft px-5 py-2 text-small text-foreground">
      {trialMessage(trial, t, locale)}{" "}
      <Link href="/dashboard/settings/plan" className="font-medium underline underline-offset-2">
        {t("banners.choosePlan")}
      </Link>
    </div>
  );
}
