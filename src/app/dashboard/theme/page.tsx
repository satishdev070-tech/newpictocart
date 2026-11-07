import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { getBuilderData } from "@/features/theme/site-builder/server/data";
import { BuilderErrorBoundary } from "@/features/theme/site-builder/components/builder-error-boundary";
import { ThemeBuilderClient } from "@/features/theme/site-builder/components/theme-builder-client";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Theme editor" };

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
      <ThemeBuilderClient data={data} />
    </BuilderErrorBoundary>
  );
}
