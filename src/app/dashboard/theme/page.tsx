import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { getBuilderData } from "@/features/theme/site-builder/server/data";
import { BuilderErrorBoundary } from "@/features/theme/site-builder/components/builder-error-boundary";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Theme editor" };

const SiteBuilder = dynamic(() => import("@/features/theme/site-builder/components/site-builder").then((m) => m.SiteBuilder), {
  loading: () => <div className="fixed inset-0 animate-pulse bg-surface-secondary" aria-busy="true" />,
});

export default async function ThemePage() {
  const ctx = await requireTenantPermission("theme.edit");
  const data = await getBuilderData(ctx);
  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <ErrorState
          title="Theme editor couldn't load"
          description="We couldn't load your theme draft. Your live store is unchanged. Try again in a moment."
          action={
            <Link href="/dashboard/theme" className={buttonClass({ variant: "secondary" })}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <BuilderErrorBoundary>
      <SiteBuilder data={data} />
    </BuilderErrorBoundary>
  );
}
