import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { OverviewSkeleton } from "@/components/app-shell/skeletons";
import { AdminOverviewBody } from "./overview-body";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminHome() {
  const ctx = await requirePlatform("platform.tenants.read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description={`All stores across the platform · ${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date())}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {ctx.permissions.has("platform.settings.manage") ? (
              <Link href="/admin/analytics" className={buttonClass({ variant: "secondary" })}>
                <BarChart3 aria-hidden /> Analytics
              </Link>
            ) : null}
            {ctx.permissions.has("platform.tenants.manage") ? (
              <Link href="/admin/tenants/new" className={buttonClass({ variant: "accent" })}>
                <Plus aria-hidden /> New store
              </Link>
            ) : null}
          </div>
        }
      />

      <Suspense fallback={<OverviewSkeleton />}>
        <AdminOverviewBody />
      </Suspense>
    </div>
  );
}
