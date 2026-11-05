import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlatform } from "@/lib/platform/access";
import { PageHeader } from "@/components/ui/layout";
import { OverviewSkeleton } from "@/components/app-shell/skeletons";
import { AdminRevenueBody } from "./revenue-body";

export const metadata: Metadata = { title: "Revenue P&L" };

export default async function RevenuePage() {
  await requirePlatform("platform.finance.read");

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue P&L" description="Subscriptions, GMV commission, AI credit packs and theme sales, net of AI cost. All amounts in ₹." />
      <Suspense fallback={<OverviewSkeleton />}>
        <AdminRevenueBody />
      </Suspense>
    </div>
  );
}
