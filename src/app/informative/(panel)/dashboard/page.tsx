import type { Metadata } from "next";
import { requireInformativeTenant } from "@/features/informative/server/context";

export const metadata: Metadata = { title: "Dashboard" };

/** Informative dashboard (M1 placeholder; checklist, enquiries and publish arrive in M5). */
export default async function InformativeDashboardPage() {
  const ctx = await requireInformativeTenant();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="font-display text-2xl">Welcome, {ctx.tenantName}</h1>
      <p className="text-muted">Your website dashboard is being set up.</p>
    </section>
  );
}
