import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTenant } from "@/lib/tenant/membership";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { PageHeader } from "@/components/ui/layout";
import { OverviewSkeleton } from "@/components/app-shell/skeletons";
import { CopyButton } from "@/features/domains/components/domain-controls";
import { getI18n } from "@/lib/i18n/server";
import { DashboardHomeBody } from "./home-body";

export const metadata: Metadata = { title: "Home" };

function greeting(now = new Date()): "pages.home.morning" | "pages.home.afternoon" | "pages.home.evening" {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  return h < 12 ? "pages.home.morning" : h < 17 ? "pages.home.afternoon" : "pages.home.evening";
}

/**
 * Seller home: header paints immediately; KPI/sales/orders stream under Suspense so slow RPCs
 * show OverviewSkeleton instead of holding a blank route or pink-screening the segment.
 */
export default async function DashboardHome() {
  const ctx = await requireTenant();
  const { t, m } = await getI18n();
  const storeUrl = storeOrigin(storeSubdomain(ctx.tenantSlug));
  const firstName = ctx.user.displayName?.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(greeting())}${firstName ? `, ${firstName}` : ""}`}
        description={t("pages.home.last30", { store: ctx.tenantName })}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <span className="max-w-[12rem] truncate text-sm text-muted sm:max-w-[18rem]" title={storeUrl}>
              {storeUrl.replace(/^https?:\/\//, "")}
            </span>
            <CopyButton value={storeUrl} label="storefront URL" />
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background">
              View store ↗
            </a>
          </div>
        }
      />

      <Suspense fallback={<OverviewSkeleton />}>
        <DashboardHomeBody coachText={m.ai.coach} walletText={m.ai.wallet} />
      </Suspense>
    </div>
  );
}
