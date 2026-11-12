import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InformativeShell } from "@/features/informative/onboarding/components/shell";
import { TypeSelector } from "@/features/informative/onboarding/components/type-selector";
import { informativeOnboardingAllowed } from "@/features/informative/server/onboarding-gate";
import { onboardingLogo } from "@/features/informative/server/onboarding-page";
import { startSearchQuery } from "@/features/start/steps";

export const metadata: Metadata = { title: "What do you want to build?", robots: { index: false, follow: false } };

/**
 * Onboarding Step 0 (docs/informative/PLAN.md): Online Store or Informative Website. Behind
 * FEATURE_INFORMATIVE_WEBSITE: when the flag (or the internal-only stage) does not allow this
 * visitor, it forwards to the existing first step exactly as bare /start does today.
 */
export default async function StartBuildPage({ searchParams }: PageProps<"/start/build">) {
  const q = startSearchQuery((await searchParams) as Record<string, string | string[] | undefined>);
  if (!(await informativeOnboardingAllowed())) redirect(q ? `/start/lang?${q}` : "/start/lang");
  return (
    <InformativeShell logo={await onboardingLogo()} step={null} wide>
      <TypeSelector storeQuery={q} />
    </InformativeShell>
  );
}
